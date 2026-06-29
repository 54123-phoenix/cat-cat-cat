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
    [switch]$SkipUploads,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot\.."
$BackendDir = Join-Path $Root "cat-backend"
$Timestamp = (Get-Date -Format "yyyyMMdd-HHmmss")

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

# 1. Backup database files
$dbFiles = Get-ChildItem -Path $BackendDir -Filter "*.db" -File -ErrorAction SilentlyContinue
if (-not $dbFiles -or $dbFiles.Count -eq 0) {
    Write-Host "[INFO] No *.db file found under cat-backend, skipping database backup." -ForegroundColor Yellow
} else {
    foreach ($db in $dbFiles) {
        $target = Join-Path $Dest $db.Name
        Write-Host "[DB ] $($db.FullName) -> $target"
        if (-not $DryRun) { Copy-Item -LiteralPath $db.FullName -Destination $target -Force }
    }
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
        "db_files: $($dbFiles.Name -join ', ')"
    )
    Set-Content -LiteralPath $ManifestPath -Value $lines -Encoding UTF8
    Write-Host ""
    Write-Host "Backup done: $Dest" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "DryRun done, no files written." -ForegroundColor Cyan
}
