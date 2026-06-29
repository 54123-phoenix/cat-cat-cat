$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$Backend = Join-Path $Root "cat-backend"
$VenvPython = Join-Path $Backend ".venv/Scripts/python.exe"
$Python = if (Test-Path $VenvPython) { $VenvPython } else { "python" }

Push-Location $Backend
try {
    if (-not $env:JWT_SECRET) { $env:JWT_SECRET = "harness-test-jwt-secret" }
    if (-not $env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD = "harness-admin-password" }
    if (-not $env:DEMO_PASSWORD) { $env:DEMO_PASSWORD = "harness-demo-password" }
    if (-not $env:INIT_DEMO_USER) { $env:INIT_DEMO_USER = "0" }
    & $Python -m pytest tests
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
