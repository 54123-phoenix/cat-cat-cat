# scripts/ui_loop/run.ps1 - UI Polish Loop verification harness
# Usage:
#   .\run.ps1 -Setup
#   .\run.ps1 -Verify -Phase P1
#   .\run.ps1 -Commit -Phase P1
#   .\run.ps1 -Rollback -Phase P1
#   .\run.ps1 -Teardown
#   .\run.ps1 -Status
# Exit codes: 0=pass, 1=fail, 2=needs human

param(
  [switch]$Setup,
  [switch]$Verify,
  [switch]$Commit,
  [switch]$Rollback,
  [switch]$Teardown,
  [switch]$Status,
  [string]$Phase
)

$ErrorActionPreference = 'Stop'
$ROOT = (Resolve-Path "$PSScriptRoot\..\..").Path
$LOOP = Join-Path $ROOT '.loop'
$FE = Join-Path $ROOT 'cat-frontend'
$UILOOP = $PSScriptRoot
$PROGRESS = Join-Path $LOOP 'progress.json'
$LOG = Join-Path $LOOP 'log.md'
$FRONT_URL = 'http://localhost:5173'
$BACK_URL = 'http://localhost:8000'

function Write-Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Write-Err($m)  { Write-Host "  [X]  $m" -ForegroundColor Red }

function Ensure-Dir($d) { if (!(Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }

function Wait-Url($url, $timeoutSec = 60) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try { $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -lt 500) { return $true } } catch {}
    Start-Sleep -Milliseconds 800
  }
  return $false
}

function Get-ViteJob { Get-Job -Name 'cat-vite-dev' -ErrorAction SilentlyContinue }

function Get-Progress {
  if (Test-Path $PROGRESS) { return Get-Content $PROGRESS -Raw | ConvertFrom-Json }
  return $null
}

function Set-Progress($obj) {
  Ensure-Dir $LOOP
  $obj | ConvertTo-Json -Depth 10 | Set-Content -Path $PROGRESS -Encoding UTF8
}

function Append-Log($line) {
  Ensure-Dir $LOOP
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -Path $LOG -Value "[$ts] $line" -Encoding UTF8
}

function Set-PhaseState($prog, $p, $s) {
  $prog.phases.PSObject.Properties | Where-Object { $_.Name -eq $p } | ForEach-Object { $_.Value = $s }
}

# ---------- SETUP ----------
if ($Setup) {
  Write-Step 'UI Loop Setup'
  Ensure-Dir $LOOP

  Write-Step 'Check Docker'
  try { docker info *> $null; Write-Ok 'Docker available' }
  catch { Write-Err 'Docker not running, start Docker Desktop first'; exit 2 }

  Write-Step 'Start backend (docker compose up)'
  Push-Location $ROOT
  docker compose up -d --build
  Pop-Location
  if (!(Wait-Url "$BACK_URL/docs" 180)) { Write-Err 'backend not ready'; exit 1 }
  Write-Ok 'backend ready'

  Write-Step 'Check frontend deps'
  if (!(Test-Path (Join-Path $FE 'node_modules'))) {
    Push-Location $FE; npm install; Pop-Location
  }
  Write-Ok 'frontend deps ready'

  Write-Step 'Check loop tool deps'
  if (!(Test-Path (Join-Path $UILOOP 'node_modules'))) {
    Push-Location $UILOOP; npm install; Pop-Location
  }
  Write-Ok 'loop deps ready'

  Write-Step 'Check Playwright browser'
  $pwCache = Join-Path $env:USERPROFILE 'AppData\Local\ms-playwright'
  if (!(Test-Path $pwCache)) {
    Push-Location $UILOOP; npx playwright install chromium; Pop-Location
  }
  Write-Ok 'Playwright ready'

  Write-Step 'Check frontend dev server (docker)'
  if (Get-ViteJob) { Get-ViteJob | Remove-Job -Force }
  if (!(Wait-Url $FRONT_URL 30)) { Write-Err 'frontend not ready on 5173'; exit 1 }
  Write-Ok 'frontend ready (docker volume-mounted, reflects edits)'

  Write-Step 'Capture baseline snapshot'
  Push-Location $UILOOP
  node snapshot.mjs --url=$FRONT_URL --out=.loop/baseline --wait=3000
  Pop-Location
  Write-Ok 'baseline snapshot done'

  $phases = @('P1','P2','P3','P4a','P4b','P4c','P4d','P5','P6')
  $phaseMap = [ordered]@{}
  foreach ($p in $phases) { $phaseMap[$p] = 'pending' }
  $state = [ordered]@{
    startedAt = (Get-Date).ToString('o')
    baseline = '.loop/baseline'
    current = $null
    phases = $phaseMap
    completed = @()
    skipped = @()
  }
  Set-Progress $state
  Append-Log 'Setup complete, baseline captured'
  Write-Ok 'Setup fully complete'
  exit 0
}

# ---------- VERIFY ----------
if ($Verify) {
  if (!$Phase) { Write-Err 'need -Phase'; exit 1 }
  Write-Step "Verify $Phase"
  Ensure-Dir $LOOP

  Write-Step 'npm run build'
  Push-Location $FE
  $buildOut = & npm run build 2>&1
  $buildCode = $LASTEXITCODE
  Pop-Location
  if ($buildCode -ne 0) {
    Write-Err 'build failed'
    $buildOut | Select-Object -Last 30 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    Append-Log "$Phase VERIFY FAIL: build"
    exit 1
  }
  Write-Ok 'build passed'

  Write-Step 'Snapshot + diff'
  Write-Step 'Restart frontend container (fresh dev server)'
  Push-Location $ROOT
  $prevEAP2 = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  docker compose restart frontend 2>&1 | Out-Null
  $ErrorActionPreference = $prevEAP2
  Pop-Location
  if (!(Wait-Url $FRONT_URL 40)) { Write-Err 'frontend not ready after restart'; exit 1 }
  Write-Ok 'frontend restarted'
  Push-Location $UILOOP
  node snapshot.mjs --url=$FRONT_URL --out=".loop/after_$Phase" --baseline=.loop/baseline --wait=2500
  $snapCode = $LASTEXITCODE
  Pop-Location
  if ($snapCode -ne 0) { Write-Warn 'snapshot script nonzero exit, continuing' }

  $summaryFile = Join-Path $LOOP "after_$Phase\_summary.json"
  $consoleErrors = 0
  $maxDiffPct = 0
  if (Test-Path $summaryFile) {
    $sum = Get-Content $summaryFile -Raw | ConvertFrom-Json
    $consoleErrors = @($sum.consoleErrors).Count
    if ($sum.diffs) {
      $diffs = @($sum.diffs)
      if ($diffs.Count -gt 0) { $maxDiffPct = ($diffs | ForEach-Object { $_.pct } | Measure-Object -Maximum).Maximum }
    }
  }
  Write-Ok "snapshot done: console errors=$consoleErrors, max diff=$([math]::Round($maxDiffPct,2))%"

  Write-Step 'Lighthouse'
  Push-Location $UILOOP
  $prevEAP = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & node lighthouse.mjs --url=$FRONT_URL --out=".loop/metrics_$Phase.json" 2>&1 | Out-String | Write-Host
  $ErrorActionPreference = $prevEAP
  Pop-Location
  $lhFile = Join-Path $LOOP "metrics_$Phase.json"
  $lcp = $null; $cls = $null
  if (Test-Path $lhFile) {
    $m = Get-Content $lhFile -Raw | ConvertFrom-Json
    $lcp = $m.lcp; $cls = $m.cls
  }

  Write-Step 'Quality gate'
  $pass = $true
  $reasons = @()
  if ($consoleErrors -gt 0) { $pass = $false; $reasons += "console errors=$consoleErrors" }
  if ($cls -and $cls -gt 0.1) { $pass = $false; $reasons += "CLS=$($cls)>0.1" }
  if ($lcp) { Write-Warn "LCP=$([math]::Round($lcp))ms (informational, dev server - not gated)" }

  $prog = Get-Progress
  if ($prog) {
    $prog.current = $Phase
    Set-PhaseState $prog $Phase $(if ($pass) {'verified'} else {'failed'})
    Set-Progress $prog
  }

  if ($pass) {
    Write-Ok 'quality gate passed'
    Append-Log "$Phase VERIFY OK: console=$consoleErrors maxDiff=$([math]::Round($maxDiffPct,2))% LCP=$lcp CLS=$cls"
    exit 0
  } else {
    Write-Err "quality gate failed: $($reasons -join ', ')"
    Append-Log "$Phase VERIFY FAIL: $($reasons -join ', ')"
    exit 1
  }
}

# ---------- COMMIT ----------
if ($Commit) {
  if (!$Phase) { Write-Err 'need -Phase'; exit 1 }
  Write-Step "Commit $Phase"
  $taskFile = Join-Path $UILOOP "phase_tasks\$Phase.json"
  $title = $Phase
  if (Test-Path $taskFile) {
    try {
      $task = Get-Content $taskFile -Raw -Encoding UTF8 | ConvertFrom-Json
      $title = "$($task.id): $($task.title)"
    } catch { $title = $Phase }
  }
  Push-Location $ROOT
  git add -A
  $msg = "ui($Phase): $title"
  git commit -m $msg
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -eq 0) {
    Write-Ok "committed: $msg"
    $prog = Get-Progress
    if ($prog) {
      Set-PhaseState $prog $Phase 'committed'
      if (@($prog.completed) -notcontains $Phase) { $prog.completed = @($prog.completed) + $Phase }
      Set-Progress $prog
    }
    Append-Log "$Phase COMMITTED: $msg"
    exit 0
  } else {
    Write-Err 'git commit failed'
    exit 1
  }
}

# ---------- ROLLBACK ----------
if ($Rollback) {
  if (!$Phase) { Write-Err 'need -Phase'; exit 1 }
  Write-Step "Rollback $Phase (git stash)"
  Push-Location $ROOT
  git stash push -m "rollback-$Phase-$(Get-Date -Format 'yyyyMMddHHmmss')"
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -eq 0) {
    Write-Ok "rolled back $Phase"
    $prog = Get-Progress
    if ($prog) {
      Set-PhaseState $prog $Phase 'rolled-back'
      if (@($prog.skipped) -notcontains $Phase) { $prog.skipped = @($prog.skipped) + $Phase }
      Set-Progress $prog
    }
    Append-Log "$Phase ROLLED BACK"
    exit 0
  } else {
    Write-Err 'git stash failed'
    exit 1
  }
}

# ---------- TEARDOWN ----------
if ($Teardown) {
  Write-Step 'Teardown'
  $j = Get-ViteJob
  if ($j) { $j | Remove-Job -Force; Write-Ok 'vite dev stopped' }
  Push-Location $ROOT
  docker compose down
  Pop-Location
  Write-Ok 'docker compose down done'
  Append-Log 'Teardown complete'
  exit 0
}

# ---------- STATUS ----------
if ($Status) {
  $prog = Get-Progress
  if (!$prog) { Write-Host 'no progress.json, not setup'; exit 0 }
  Write-Host 'Loop status:'
  Write-Host "  started: $($prog.startedAt)"
  Write-Host "  current: $($prog.current)"
  Write-Host "  completed: $($prog.completed -join ', ')"
  Write-Host "  skipped: $($prog.skipped -join ', ')"
  Write-Host '  phases:'
  $prog.phases.PSObject.Properties | ForEach-Object { Write-Host ('    {0,-5} {1}' -f $_.Name, $_.Value) }
  exit 0
}

Write-Host 'Usage: .\run.ps1 -Setup | -Verify -Phase P1 | -Commit -Phase P1 | -Rollback -Phase P1 | -Teardown | -Status'
exit 0
