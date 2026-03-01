# ============================================================
# COVE - Redéploiement rapide (auth déjà faite)
# Usage : .\redeploy.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$GCLOUD = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$PROJECT = "covestudio"
$REGION = "europe-west1"
$SERVICE = "cove-api"
$ROOT = $PSScriptRoot
$BACKEND = Join-Path $ROOT "backend"
$TMPDIR = Join-Path $env:TEMP "cove-deploy-$(Get-Random)"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  COVE - Redéploiement Cloud Run + Hosting" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# ---- 1. Lire backend/.env et générer les variables ----
Write-Host ""
Write-Host "[1/4] Generation des variables d'environnement..." -ForegroundColor Yellow

$envFile = Join-Path $BACKEND ".env"
if (-not (Test-Path $envFile)) { Write-Error "backend/.env introuvable."; exit 1 }

$envVars = [ordered]@{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
        $envVars[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}
# PORT est réservé par Cloud Run
$envVars.Remove("PORT")
$envVars["NODE_ENV"] = "production"

# Encoder le service account en base64
$saFile = Join-Path $ROOT "covestudio-firebase-adminsdk-fbsvc-854611e7e9.json"
if (Test-Path $saFile) {
    $saBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content $saFile -Raw)))
    $envVars["FIREBASE_SERVICE_ACCOUNT"] = $saBase64
    Write-Host "  OK - Service account encode en base64" -ForegroundColor Green
} else {
    Write-Host "  ATTENTION : service account JSON non trouve" -ForegroundColor Red
}
Write-Host "  OK - $($envVars.Count) variables pretes" -ForegroundColor Green

# ---- 2. Créer un dossier temp propre (sans node_modules, timestamps frais) ----
Write-Host ""
Write-Host "[2/4] Creation dossier temp propre pour l'upload gcloud..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $TMPDIR -Force | Out-Null

# Copier uniquement les fichiers sources (pas node_modules)
$filesToCopy = @(
    "server.js",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    ".dockerignore"
)
foreach ($f in $filesToCopy) {
    $src = Join-Path $BACKEND $f
    if (Test-Path $src) {
        Copy-Item $src $TMPDIR
    }
}

# Copier le dossier src/
Copy-Item (Join-Path $BACKEND "src") $TMPDIR -Recurse

# Écrire le YAML des variables dans le dossier temp
$yamlLines = foreach ($kv in $envVars.GetEnumerator()) {
    $escaped = $kv.Value -replace '\\', '\\' -replace '"', '\"'
    "$($kv.Key): `"$escaped`""
}
$yamlLines | Set-Content (Join-Path $TMPDIR ".env-cloudrun.yaml") -Encoding UTF8

# Écrire un .gcloudignore minimal
".gcloudignore`n.env-cloudrun.yaml.bak" | Set-Content (Join-Path $TMPDIR ".gcloudignore") -Encoding UTF8

# Forcer les timestamps de TOUS les fichiers du dossier temp à maintenant
$now = Get-Date
Get-ChildItem -Path $TMPDIR -Recurse -File | ForEach-Object {
    $_.LastWriteTime = $now
    $_.CreationTime = $now
}
Write-Host "  OK - Dossier temp : $TMPDIR" -ForegroundColor Green

# ---- 3. Déployer le backend sur Cloud Run ----
Write-Host ""
Write-Host "[3/4] Deploiement backend sur Cloud Run..." -ForegroundColor Yellow
Write-Host "  (3-5 minutes - Cloud Build compile l'image Docker)" -ForegroundColor Gray

Push-Location $TMPDIR
try {
    & $GCLOUD run deploy $SERVICE `
        --source . `
        --region $REGION `
        --allow-unauthenticated `
        --env-vars-file ".env-cloudrun.yaml" `
        --memory 512Mi `
        --cpu 1 `
        --min-instances 0 `
        --max-instances 10 `
        --project $PROJECT
} finally {
    Pop-Location
    Remove-Item $TMPDIR -Recurse -Force -ErrorAction SilentlyContinue
}

$cloudRunUrl = (& $GCLOUD run services describe $SERVICE --region $REGION --format "value(status.url)" --project $PROJECT 2>$null)
Write-Host "  OK - Backend : $cloudRunUrl" -ForegroundColor Green

# ---- 4. Déployer Firebase Hosting ----
Write-Host ""
Write-Host "[4/4] Deploiement Firebase Hosting..." -ForegroundColor Yellow
Push-Location $ROOT
try {
    & firebase deploy --only hosting
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  DEPLOIEMENT TERMINE !" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend API : $cloudRunUrl" -ForegroundColor Cyan
Write-Host "  Frontend    : https://$PROJECT.web.app" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Etape suivante : lier ton domaine OVHcloud" -ForegroundColor Yellow
Write-Host "  -> https://console.firebase.google.com/project/$PROJECT/hosting" -ForegroundColor Yellow
Write-Host ""
