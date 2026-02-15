// Global Setup - Verification des comptes de test COVE
const BASE_URL = 'http://localhost:3000/api';

const TEST_USER = {
  email: 'test-user@cove-test.com',
  password: 'CoveTest2026!',
};

const TEST_OWNER = {
  email: 'test-owner@cove-test.com',
  password: 'CoveOwner2026!',
};

async function ensureAccount(email, password) {
  // Essayer le login d'abord (moins couteux en rate limit)
  try {
    const loginRes = await fetch(`${BASE_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (loginRes.ok) {
      const data = await loginRes.json();
      console.log(`  Compte ${email} OK (login reussi)`);
      return data;
    }
  } catch (e) {
    // Login echoue, on tente la creation
  }

  // Creer le compte si le login echoue
  try {
    const registerRes = await fetch(`${BASE_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (registerRes.ok) {
      const data = await registerRes.json();
      console.log(`  Compte ${email} cree`);
      return data;
    }

    const errData = await registerRes.json();
    if (registerRes.status === 409) {
      console.log(`  Compte ${email} existe deja`);
      return null;
    }

    console.log(`  Erreur pour ${email}: ${errData.error || registerRes.statusText}`);
    return null;
  } catch (error) {
    console.log(`  Erreur pour ${email}: ${error.message}`);
    return null;
  }
}

async function globalSetup() {
  console.log('\n=== COVE - Setup des comptes de test ===\n');

  // Verifier que le backend est accessible
  try {
    const health = await fetch(`${BASE_URL}/health`);
    if (!health.ok) throw new Error('Backend non accessible');
    console.log('Backend accessible\n');
  } catch (error) {
    console.error('ERREUR: Le backend n\'est pas accessible sur http://localhost:3000');
    console.error('Lancez le backend avec: cd backend && npm run dev\n');
    throw new Error('Backend non accessible. Lancez-le avant de lancer les tests.');
  }

  // Verifier les comptes
  console.log('1. Verification du compte utilisateur...');
  await ensureAccount(TEST_USER.email, TEST_USER.password);

  console.log('\n2. Verification du compte owner...');
  await ensureAccount(TEST_OWNER.email, TEST_OWNER.password);

  console.log('\n=== Setup termine ===\n');
}

module.exports = globalSetup;
