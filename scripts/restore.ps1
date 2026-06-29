<#
.SYNOPSIS
  Campus cat project data restore script.
.DESCRIPTION
  Restores database and optional uploads from a backup directory.
  Auto-backs up current data to backups/pre-restore-<timestamp>/ before restoring.
  Requires explicit -BackupPath and -ConfirmRestore to execute.
  Restore targets always stay inside the current project root (cat-backend/).
  BackupPath may be outside the project root.
.PARAMETER BackupPath
  Backup directory path (required). May be inside or outside project root.
.PARAMETER ConfirmRestore
  Confirm to execute restore. Without this, defaults to DryRun.
.PARAMETER SkipUploads
  Skip restoring uploads. By default uploads are restored.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore.ps1 -BackupPath backups\20250101-120000 -DryRun
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,
    [switch]$ConfirmRestore,
    [switch]$SkipUploads,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot\.."
$BackendDir = Join-Path $Root "cat-backend"

if (-not (Test-Path -LiteralPath $BackupPath)) {
    Write-Host "[ERROR] Backup directory not found: $BackupPath" -ForegroundColor Red
    exit 1
}
$BackupAbs = Resolve-Path -LiteralPath $BackupPath

$IsDryRun = $DryRun -or (-not $ConfirmRestore)

Write-Host "Campus Cat Restore"
Write-Host "Project root: $Root"
Write-Host "Backup dir  : $BackupAbs"
Write-Host "Restore to  : $BackendDir (always inside project root)"
if ($IsDryRun) {
    Write-Host "Mode        : DryRun (preview only, no restore)" -ForegroundColor Cyan
} else {
    Write-Host "Mode        : LIVE RESTORE" -ForegroundColor Yellow
}
Write-Host ""

$dbBackups = Get-ChildItem -Path $BackupAbs -Filter "*.db" -File -ErrorAction SilentlyContinue
$uploadsBackup = Join-Path $BackupAbs "uploads"

if (-not $dbBackups -and -not (Test-Path $uploadsBackup)) {
    Write-Host "[ERROR] No .db file or uploads directory found in backup: $BackupAbs" -ForegroundColor Red
    exit 1
}

# 1. Pre-restore backup of current data
if (-not $IsDryRun) {
    $PreRestoreDir = Join-Path $Root "backups\pre-restore-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $PreRestoreDir -Force | Out-Null
    Write-Host "[PRE ] Backing up current data -> $PreRestoreDir" -ForegroundColor Yellow
    $currentDbs = Get-ChildItem -Path $BackendDir -Filter "*.db" -File -ErrorAction SilentlyContinue
    foreach ($db in $currentDbs) {
        Copy-Item -LiteralPath $db.FullName -Destination (Join-Path $PreRestoreDir $db.Name) -Force
    }
    $currentUploads = Join-Path $BackendDir "uploads"
    if (Test-Path $currentUploads) {
        Copy-Item -LiteralPath $currentUploads -Destination (Join-Path $PreRestoreDir "uploads") -Recurse -Force
    }
    Write-Host "[PRE ] Done." -ForegroundColor Green
    Write-Host ""
}

# 2. Restore database (target always inside project root)
if ($dbBackups) {
    foreach ($db in $dbBackups) {
        $target = Join-Path $BackendDir $db.Name
        Write-Host "[DB ] $($db.FullName) -> $target"
        if (-not $IsDryRun) {
            Copy-Item -LiteralPath $db.FullName -Destination $target -Force
        }
    }
} else {
    Write-Host "[INFO] No .db in backup, skipping database restore." -ForegroundColor Yellow
}

# 3. Restore uploads (copy only, never delete existing files; target inside project root)
if (-not $SkipUploads -and (Test-Path $uploadsBackup)) {
    $uploadsDest = Join-Path $BackendDir "uploads"
    Write-Host "[UP ] $uploadsBackup -> $uploadsDest (overwrite only, no delete)"
    if (-not $IsDryRun) {
        if (-not (Test-Path $uploadsDest)) {
            New-Item -ItemType Directory -Path $uploadsDest -Force | Out-Null
        }
        Get-ChildItem -Path $uploadsBackup -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($uploadsBackup.Length + 1)
            $destFile = Join-Path $uploadsDest $rel
            $destDir = Split-Path $destFile -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item -LiteralPath $_.FullName -Destination $destFile -Force
        }
    }
} elseif (-not $SkipUploads) {
    Write-Host "[INFO] No uploads in backup, skipping uploads restore." -ForegroundColor Yellow
} else {
    Write-Host "[SKIP] uploads skipped (-SkipUploads)"
}

Write-Host ""
if ($IsDryRun) {
    Write-Host "DryRun done, no files modified. Add -ConfirmRestore to execute." -ForegroundColor Cyan
} else {
    Write-Host "Restore done. Pre-restore backup at backups\pre-restore-*." -ForegroundColor Green
    Write-Host "Run backend tests and harness to verify data integrity." -ForegroundColor Yellow
}
