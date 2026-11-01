param(
    [switch]$Upload,
    [switch]$Download,
    [switch]$Bg
)

# Historical entry point: its upload/download scripts no longer exist, and the
# archived photo backup is truncated. Do not claim success or request a token.
Write-Error 'Legacy asset sync is unavailable (ISS-043). See docs/CAMPUS_DATA_PREPARATION.md. For verified model weights only, use python scripts/inference_assets.py --output-dir <new-directory>.'
exit 2
