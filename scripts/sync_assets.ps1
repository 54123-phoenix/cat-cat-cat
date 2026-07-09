param(
    [switch]$Upload,
    [switch]$Download,
    [switch]$Bg  # run in background (hidden window, no output)
)

$PY = "C:\Users\Phoenix\AppData\Local\Programs\Python\Python311\python.exe"
$DIR = "D:\Desktop\cat"

if ($Bg) {
    # Re-launch self in hidden window
    $arg = ""
    if ($Upload) { $arg = "-Upload" }
    if ($Download) { $arg = "-Download" }
    $ps = Start-Process powershell -WindowStyle Hidden -ArgumentList "-File `"$PSCommandPath`" $arg" -PassThru
    Write-Output "PID: $($ps.Id)  —  close terminal safely, upload continues"
    exit
}

function Upload-Assets {
    Write-Output "=== Uploading model & data to Hugging Face ==="
    if (-not $env:HF_TOKEN) {
        $env:HF_TOKEN = Read-Host "Enter your HF_TOKEN"
    }
    & $PY "$DIR\scripts\upload_assets.py" 2>&1
    Write-Output "=== Upload done! ==="
}

function Download-Assets {
    Write-Output "=== Downloading model & data from Hugging Face ==="
    & $PY "$DIR\scripts\download_assets.py" 2>&1
    Write-Output "=== Download complete ==="
}

if ($Upload) { Upload-Assets }
elseif ($Download) { Download-Assets }
else {
    Write-Output "Usage:"
    Write-Output "  .\scripts\sync_assets.ps1 -Upload     # upload to HF (foreground)"
    Write-Output "  .\scripts\sync_assets.ps1 -Upload -Bg # upload in background (close terminal)"
    Write-Output "  .\scripts\sync_assets.ps1 -Download   # download from HF"
}
