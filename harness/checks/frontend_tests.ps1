$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$Frontend = Join-Path $Root "cat-frontend"

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Error "cat-frontend/node_modules not found. Run npm install in cat-frontend before full harness."
}

Push-Location $Frontend
try {
    npm test
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
