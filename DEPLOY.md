# Guide de déploiement COVE

Architecture :
- **Firebase Hosting** → sert les fichiers statiques HTML/CSS/JS/images (CDN mondial)
- **Cloud Run** → héberge le backend Express (API `/api/**`)
- **Domaine OVHcloud** → lié à Firebase Hosting

---

## Méthode rapide : script automatique

Lance simplement depuis PowerShell :

```powershell
.\deploy.ps1
```

Le script fait tout : authentification, déploiement Cloud Run, déploiement Firebase Hosting.

---

## Méthode manuelle étape par étape

### Prérequis (déjà installés)
- Firebase CLI 15.7.0 (`firebase --version`)
- Google Cloud SDK 557.0.0 (`gcloud --version`)

### Étape 1 — Authentification

```powershell
# Depuis PowerShell
$GCLOUD = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
& $GCLOUD auth login
& $GCLOUD config set project covestudio
firebase login
```

### Étape 2 — Déployer le backend sur Cloud Run

```powershell
# Lire le service account en JSON inline
$SA = (Get-Content "covestudio-firebase-adminsdk-fbsvc-854611e7e9.json" -Raw) -replace "`r`n","" -replace "`n",""

cd backend
& $GCLOUD run deploy cove-api `
  --source . `
  --region europe-west1 `
  --allow-unauthenticated `
  --set-env-vars="NODE_ENV=production,FIREBASE_DATABASE_URL=https://covestudio-default-rtdb.europe-west1.firebasedatabase.app,FRONTEND_URL=https://TON-DOMAINE.fr,SHOPIFY_SHOP=cove-9465.myshopify.com,FIREBASE_SERVICE_ACCOUNT=$SA"
```

### Étape 3 — Déployer Firebase Hosting

```powershell
cd ..   # retour à la racine
firebase deploy --only hosting
```

Firebase donne une URL : `https://covestudio.web.app`

---

## Étape 4 — Lier le domaine OVHcloud

### Dans Firebase Console
1. `https://console.firebase.google.com` → projet `covestudio` → **Hosting**
2. **Ajouter un domaine personnalisé** → entre ton domaine (ex: `cove.fr`)
3. Firebase donne un enregistrement **TXT** de vérification

### Dans OVHcloud (Zone DNS)
1. Espace client OVHcloud → **Domaines** → ton domaine → **Zone DNS**
2. **Ajouter une entrée TXT** :
   - Sous-domaine : vide
   - Valeur : la valeur TXT donnée par Firebase
3. Cliquer **Vérifier** dans Firebase (5 min d'attente DNS)

Après vérification, Firebase donne des enregistrements **A** :
```
151.101.1.195
151.101.65.195
```

4. **Deux entrées A** dans OVHcloud :
   - Sous-domaine : vide → `151.101.1.195`
   - Sous-domaine : vide → `151.101.65.195`

5. **Entrée CNAME pour www** :
   - Sous-domaine : `www`
   - Cible : `ton-domaine.fr.`

Propagation : 5 min à 24h. SSL automatique par Firebase.

---

## Étape 5 — Mettre à jour FRONTEND_URL

Une fois le domaine actif, mettre à jour dans `backend/.env` :
```
FRONTEND_URL=https://ton-domaine.fr
```

Puis relancer `.\deploy.ps1` pour redéployer le backend.

---

## Étape 6 — Mettre à jour le webhook Shopify

Dans le dashboard Shopify → **Paramètres → Notifications → Webhooks** :
- Mettre à jour l'URL du webhook `orders/paid` :
  `https://ton-domaine.fr/api/webhooks/shopify`

---

## Redéploiements futurs

```powershell
# Tout redéployer
.\deploy.ps1

# Seulement le backend
cd backend
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy cove-api --source . --region europe-west1 --allow-unauthenticated

# Seulement le frontend
firebase deploy --only hosting
```

---

## Vérification finale

- [ ] `https://ton-domaine.fr` → page d'accueil
- [ ] `https://ton-domaine.fr/api/health` → `{"status":"ok",...}`
- [ ] `https://www.ton-domaine.fr` → redirige
- [ ] Connexion compte / Google OAuth fonctionne
- [ ] Paiement Shopify fonctionne
- [ ] Emails de confirmation reçus
