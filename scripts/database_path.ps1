function Resolve-CatDatabasePath {
    param([string]$BackendDir, [string]$DatabasePath, [switch]$AllowMissing)
    if ($DatabasePath) {
        if ([IO.Path]::IsPathRooted($DatabasePath)) { return [IO.Path]::GetFullPath($DatabasePath) }
        return [IO.Path]::GetFullPath((Join-Path $BackendDir $DatabasePath))
    }
    $Candidates = @(@(
        (Join-Path $BackendDir 'data/cat_community.db'),
        (Join-Path $BackendDir 'cat_community.db')
    ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
    if (@($Candidates).Count -gt 1) { throw 'Multiple databases found. Specify -DatabasePath explicitly.' }
    if (@($Candidates).Count -eq 1) { return [string]$Candidates[0] }
    if ($AllowMissing) { return (Join-Path $BackendDir 'data/cat_community.db') }
    throw 'Database not found. Specify the actual host file using -DatabasePath.'
}
