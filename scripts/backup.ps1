<#
.SYNOPSIS
  Campus cat project data backup script.
.DESCRIPTION
  Backs up cat-backend/*.db and cat-backend/uploads/ to <BackupDir>/<timestamp>/.
  Does not delete any files. Supports DryRun preview.
.PARAMETER BackupDir
  Backup root directory. Relative paths resolve under project root; absolute paths used as-is. Default "backups".
.PARAMETER SkipUploads
  Skip the uploads directory. By default uploads are included.
.PARAMETER DryRun
  Print actions only, do not copy.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1 -DryRun
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1 -SkipUploads -DryRun
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1 -BackupDir D:\cat-backups -DryRun
#>
param(
    [string]$BackupDir = "backups",
    [string]$DatabasePath = "",
    [string]$Python = "python",
    [switch]$SkipUploads,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot\.."
$BackendDir = Join-Path $Root "cat-backend"
. (Join-Path $PSScriptRoot 'database_path.ps1')
$DatabaseFile = Resolve-CatDatabasePath -BackendDir $BackendDir -DatabasePath $DatabasePath -AllowMissing:$DryRun
$Timestamp = (Get-Date -Format "yyyyMMdd-HHmmss-fff")

# Resolve BackupDir: absolute paths used as-is, relative resolved under project root
if ([System.IO.Path]::IsPathRooted($BackupDir)) {
    $BackupRoot = $BackupDir
} else {
    $BackupRoot = Join-Path $Root $BackupDir
}
$Dest = Join-Path $BackupRoot $Timestamp

Write-Host "Campus Cat Backup"
Write-Host "Project root: $Root"
Write-Host "Backup dest : $Dest"
if ($DryRun) { Write-Host "Mode        : DryRun (preview only, no copy)" }
Write-Host ""

if (-not $DryRun) {
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
}

# 1. Consistent snapshot includes committed WAL transactions.
$target = Join-Path $Dest 'cat_community.db'
Write-Host "[DB ] $DatabaseFile -> $target"
if (-not $DryRun) {
    & $Python (Join-Path $PSScriptRoot 'sqlite_backup.py') $DatabaseFile $target
    if ($LASTEXITCODE -ne 0) { throw 'SQLite backup failed' }
}

# 2. Backup uploads
if (-not $SkipUploads) {
    $UploadsSrc = Join-Path $BackendDir "uploads"
    if (Test-Path -LiteralPath $UploadsSrc) {
        $UploadsDest = Join-Path $Dest "uploads"
        Write-Host "[UP ] $UploadsSrc -> $UploadsDest"
        if (-not $DryRun) {
            Copy-Item -LiteralPath $UploadsSrc -Destination $UploadsDest -Recurse -Force
        }
    } else {
        Write-Host "[INFO] cat-backend/uploads not found, skipping uploads backup." -ForegroundColor Yellow
    }
} else {
    Write-Host "[SKIP] uploads skipped (-SkipUploads)"
}

# 3. Write manifest
$ManifestPath = Join-Path $Dest "manifest.txt"
if (-not $DryRun) {
    $lines = @(
        "timestamp: $Timestamp",
        "project_root: $Root",
        "skip_uploads: $SkipUploads",
        "db_files: cat_community.db",
        "database_source: $DatabaseFile",
        "database_snapshot: sqlite-online-backup"
    )
    Set-Content -LiteralPath $ManifestPath -Value $lines -Encoding UTF8
    Write-Host ""
    Write-Host "Backup done: $Dest" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "DryRun done, no files written." -ForegroundColor Cyan
}
