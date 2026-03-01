# ============================================================
# COVE - Script de déploiement complet
# Usage (depuis PowerShell) : .\deploy.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$GCLOUD = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$PROJECT = "covestudio"
$REGION = "europe-west1"
$SERVICE = "cove-api"
$ROOT = $PSScriptRoot
$BACKEND = Join-Path $ROOT "backend"
$YAML_FILE = Join-Path $BACKEND ".env-cloudrun.yaml"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  COVE - Deploiement Firebase + Cloud Run" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Vérifier les outils ----
Write-Host "[1/7] Verification des outils..." -ForegroundColor Yellow
if (-not (Test-Path $GCLOUD)) { Write-Error "gcloud non trouve."; exit 1 }
$null = & firebase --version 2>$null
Write-Host "  OK" -ForegroundColor Green

# ---- 2. Authentification gcloud ----
Write-Host ""
Write-Host "[2/7] Authentification Google Cloud (navigateur)..." -ForegroundColor Yellow
& $GCLOUD auth login
& $GCLOUD config set project $PROJECT
Write-Host "  OK - Projet : $PROJECT" -ForegroundColor Green

# ---- 3. Authentification Firebase ----
Write-Host ""
Write-Host "[3/7] Authentification Firebase (navigateur)..." -ForegroundColor Yellow
& firebase login
Write-Host "  OK" -ForegroundColor Green

# ---- 4. Lire backend/.env et générer le YAML ----
Write-Host ""
Write-Host "[4/7] Generation du fichier de variables..." -ForegroundColor Yellow

$envFile = Join-Path $BACKEND ".env"
if (-not (Test-Path $envFile)) {
    Write-Error "backend/.env introuvable."
    exit 1
}

$envVars = [ordered]@{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
        $envVars[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}

# Valeurs forcées pour production (PORT est réservé par Cloud Run, ne pas l'inclure)
$envVars["NODE_ENV"] = "production"
$envVars.Remove("PORT")

# Encoder le service account en base64 pour éviter les caractères spéciaux
$saFile = Join-Path $ROOT "covestudio-firebase-adminsdk-fbsvc-854611e7e9.json"
if (Test-Path $saFile) {
    $saBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content $saFile -Raw)))
    $envVars["FIREBASE_SERVICE_ACCOUNT"] = $saBase64
    Write-Host "  OK - Service account Firebase encode" -ForegroundColor Green
} else {
    Write-Host "  ATTENTION : service account JSON non trouve a la racine" -ForegroundColor Red
}

# Écrire le fichier YAML dans backend/ (là où gcloud run deploy --source . sera exécuté)
$yamlLines = foreach ($kv in $envVars.GetEnumerator()) {
    $escaped = $kv.Value -replace '\\', '\\' -replace '"', '\"'
    "$($kv.Key): `"$escaped`""
}
$yamlLines | Set-Content $YAML_FILE -Encoding UTF8

Write-Host "  OK - $($envVars.Count) variables -> .env-cloudrun.yaml" -ForegroundColor Green

# ---- 5. Activer les APIs Google Cloud ----
Write-Host ""
Write-Host "[5/7] Activation des APIs Google Cloud..." -ForegroundColor Yellow
& $GCLOUD services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $PROJECT
Write-Host "  OK" -ForegroundColor Green

# ---- 6. Déployer le backend sur Cloud Run ----
Write-Host ""
Write-Host "[6/7] Deploiement backend sur Cloud Run..." -ForegroundColor Yellow
Write-Host "  (3-5 minutes - Cloud Build compile l'image Docker)" -ForegroundColor Gray

Push-Location $BACKEND
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
    Remove-Item $YAML_FILE -ErrorAction SilentlyContinue
}

$cloudRunUrl = (& $GCLOUD run services describe $SERVICE --region $REGION --format "value(status.url)" --project $PROJECT 2>$null)
Write-Host "  OK - Backend : $cloudRunUrl" -ForegroundColor Green

# ---- 7. Déployer Firebase Hosting ----
Write-Host ""
Write-Host "[7/7] Deploiement Firebase Hosting..." -ForegroundColor Yellow
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
