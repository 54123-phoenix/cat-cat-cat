$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")

$Frontend = Join-Path $Root "cat-frontend"
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Error "cat-frontend/node_modules not found. Run npm install in cat-frontend before full harness."
}

Push-Location $Frontend
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}

$MiniProgram = Join-Path $Root "cat-miniprogram/package.json"
node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log('miniprogram package ok')" $MiniProgram
exit $LASTEXITCODE
