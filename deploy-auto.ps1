# ============================================================
# COVE - Deploiement automatique (sans auth interactive)
# Suppose gcloud deja authentifie. Hosting via tests/deploy-hosting.js.
# ============================================================

$ErrorActionPreference = "Stop"
$GCLOUD = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$PROJECT = "covestudio"
$REGION = "europe-west1"
$SERVICE = "cove-api"
$ROOT = $PSScriptRoot
$BACKEND = Join-Path $ROOT "backend"
$YAML_FILE = Join-Path $BACKEND ".env-cloudrun.yaml"

Write-Host "[1/4] Verification gcloud auth..." -ForegroundColor Yellow
& $GCLOUD config set project $PROJECT
Write-Host "  OK" -ForegroundColor Green

Write-Host ""
Write-Host "[2/4] Generation .env-cloudrun.yaml..." -ForegroundColor Yellow

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

$envVars["NODE_ENV"] = "production"
$envVars.Remove("PORT")

$saFile = Join-Path $ROOT "covestudio-firebase-adminsdk-fbsvc-854611e7e9.json"
if (Test-Path $saFile) {
    $saBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Content $saFile -Raw)))
    $envVars["FIREBASE_SERVICE_ACCOUNT"] = $saBase64
    Write-Host "  OK - Service account encode" -ForegroundColor Green
}

$yamlLines = foreach ($kv in $envVars.GetEnumerator()) {
    $escaped = $kv.Value -replace '\\', '\\' -replace '"', '\"'
    "$($kv.Key): `"$escaped`""
}
$yamlLines | Set-Content $YAML_FILE -Encoding UTF8
Write-Host "  OK - $($envVars.Count) variables" -ForegroundColor Green

Write-Host ""
Write-Host "[3/4] Deploiement Cloud Run..." -ForegroundColor Yellow
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

Write-Host ""
Write-Host "[4/4] Deploiement Firebase Hosting (via REST API)..." -ForegroundColor Yellow
Push-Location $ROOT
try {
    & node tests/deploy-hosting.js
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "DEPLOIEMENT TERMINE" -ForegroundColor Green
Write-Host "  Backend : $cloudRunUrl" -ForegroundColor Cyan
Write-Host "  Frontend: https://covestudio.fr" -ForegroundColor Cyan
