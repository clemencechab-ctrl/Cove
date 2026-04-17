// Deploiement manuel Firebase Hosting via REST API.
// Utilise l'access token de gcloud (authentifie en tant que clemence.chab@gmail.com)
// pour contourner le probleme d'auth du CLI Firebase.
//
// Lancer : node tests/deploy-hosting.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SITE = 'covestudio';
const ROOT = path.join(__dirname, '..');
const FIREBASE_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
const HOSTING = FIREBASE_JSON.hosting;
const PUBLIC_DIR = path.resolve(ROOT, HOSTING.public || '.');
const IGNORE = HOSTING.ignore || [];

function log(step, msg) { console.log(`\n[${step}] ${msg}`); }

function getAccessToken() {
    const gcloud = 'C:\\Users\\cynak\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';
    return execSync(`"${gcloud}" auth print-access-token`, { encoding: 'utf8' }).trim();
}

// Convert firebase ignore glob pattern to regex
function globToRegex(glob) {
    // simplistic but covers the patterns in firebase.json: **, *, fixed strings
    let s = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    s = s.replace(/\*\*\//g, '(?:.+/)?');
    s = s.replace(/\*\*/g, '.*');
    s = s.replace(/\*/g, '[^/]*');
    return new RegExp('^' + s + '$');
}

const IGNORE_REGEXES = IGNORE.map(globToRegex);
const ALSO_IGNORE = [
    /^\.git(\/|$)/,
    /^\.github(\/|$)/,
    /^\.firebase(\/|$)/,
    /^\.vscode(\/|$)/,
    /^node_modules(\/|$)/,
    /^backend(\/|$)/,
    /^tests(\/|$)/,
    /\.map$/,
];

function isIgnored(relPath) {
    for (const re of IGNORE_REGEXES) if (re.test(relPath) || re.test(path.basename(relPath))) return true;
    for (const re of ALSO_IGNORE) if (re.test(relPath)) return true;
    return false;
}

function* walk(dir, base = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (isIgnored(rel)) continue;
        if (entry.isDirectory()) {
            yield* walk(full, rel);
        } else if (entry.isFile()) {
            yield { full, rel };
        }
    }
}

function sha256HexOf(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

async function api(method, url, token, body, headers = {}) {
    const h = {
        'Authorization': `Bearer ${token}`,
        'x-goog-user-project': 'covestudio',
        ...headers
    };
    if (body && !(body instanceof Buffer)) {
        h['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }
    const res = await fetch(url, { method, headers: h, body });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(_) { data = text; }
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${method} ${url}: ${text.substring(0, 300)}`);
    }
    return data;
}

(async () => {
    try {
        log('1/7', 'Collecte des fichiers a deployer (filtrage ignore)');
        const files = [];
        for (const f of walk(PUBLIC_DIR)) {
            const content = fs.readFileSync(f.full);
            const gz = zlib.gzipSync(content);
            const hash = sha256HexOf(gz);
            files.push({ ...f, gz, hash, urlPath: '/' + f.rel.replace(/\\/g, '/') });
        }
        console.log(`      ${files.length} fichier(s)`);
        console.log(`      Total gzip : ${(files.reduce((s,f)=>s+f.gz.length,0)/1024).toFixed(1)} Ko`);

        log('2/7', 'Recuperation du token gcloud (clemence.chab@gmail.com)');
        const token = getAccessToken();
        console.log(`      OK len=${token.length}`);

        log('3/7', `Creation d'une nouvelle version sur le site ${SITE}`);
        // REST API uses "glob" where CLI config uses "source"
        const rewrites = (HOSTING.rewrites || []).map(r => {
            const out = { ...r };
            if (out.source && !out.glob) { out.glob = out.source; delete out.source; }
            return out;
        });
        const version = await api('POST',
            `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/versions`,
            token,
            { config: { rewrites } }
        );
        const versionName = version.name; // sites/X/versions/Y
        console.log(`      version : ${versionName}`);

        log('4/7', 'Populate files (declare les SHA256 attendus)');
        const filesMap = {};
        files.forEach(f => { filesMap[f.urlPath] = f.hash; });
        const populated = await api('POST',
            `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`,
            token,
            { files: filesMap }
        );
        const required = populated.uploadRequiredHashes || [];
        const uploadUrl = populated.uploadUrl;
        console.log(`      ${required.length} fichier(s) a uploader (gzip)`);

        log('5/7', 'Upload des fichiers manquants');
        let uploaded = 0;
        for (const hash of required) {
            const f = files.find(x => x.hash === hash);
            if (!f) { console.log(`      WARN: hash ${hash} introuvable`); continue; }
            const res = await fetch(`${uploadUrl}/${hash}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-goog-user-project': 'covestudio',
                    'Content-Type': 'application/octet-stream'
                },
                body: f.gz
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(`Upload fail ${f.urlPath}: HTTP ${res.status} ${t.substring(0, 200)}`);
            }
            uploaded++;
            if (uploaded % 10 === 0 || uploaded === required.length) {
                process.stdout.write(`\r      uploaded ${uploaded}/${required.length}`);
            }
        }
        if (required.length > 0) console.log('');

        log('6/7', 'Finalisation de la version (status=FINALIZED)');
        await api('PATCH',
            `https://firebasehosting.googleapis.com/v1beta1/${versionName}?updateMask=status`,
            token,
            { status: 'FINALIZED' }
        );
        console.log('      OK');

        log('7/7', `Release de la version sur le site ${SITE}`);
        const release = await api('POST',
            `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/releases?versionName=${encodeURIComponent(versionName)}`,
            token,
            {}
        );
        console.log(`      Release : ${release.name}`);

        console.log('\n══════════════════════════════════════════════════');
        console.log('  ✅ DEPLOIEMENT FIREBASE HOSTING REUSSI');
        console.log('══════════════════════════════════════════════════');
        console.log(`  URLs :`);
        console.log(`    https://covestudio.fr`);
        console.log(`    https://covestudio.web.app`);
        console.log(`  Fichiers deployes : ${files.length}`);
        console.log(`  Fichiers uploades (nouveaux) : ${uploaded}`);

    } catch (err) {
        console.error('\n  ERREUR:', err.message);
        process.exit(1);
    }
})();
