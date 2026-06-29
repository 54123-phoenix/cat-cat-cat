param(
    [ValidateSet("quick", "full")]
    [string]$Mode = "quick",
    [switch]$ContinueOnFailure
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ReportsDir = Join-Path $PSScriptRoot "reports"
$LatestJson = Join-Path $ReportsDir "latest.json"
$LatestMd = Join-Path $ReportsDir "latest.md"

New-Item -ItemType Directory -Force -Path $ReportsDir | Out-Null

$checks = @(
    @{ id = "G0-static"; name = "Static project contract"; command = @("python", "harness/checks/api_contract_check.py") },
    @{ id = "G2-security"; name = "Security and upload contract"; command = @("python", "harness/checks/security_check.py") },
    @{ id = "G5-docs"; name = "Harness docs contract"; command = @("python", "harness/checks/docs_check.py") }
)

if ($Mode -eq "full") {
    $checks += @(
        @{ id = "G1-backend-tests"; name = "Backend tests"; command = @("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "harness/checks/backend_tests.ps1") },
        @{ id = "G1-frontend-tests"; name = "Frontend tests"; command = @("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "harness/checks/frontend_tests.ps1") },
        @{ id = "G0-build"; name = "Build checks"; command = @("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "harness/checks/build_check.ps1") }
    )
}

Push-Location $Root
try {
    $results = @()
    foreach ($check in $checks) {
        Write-Host "==> $($check.name)"
        $started = Get-Date
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $output = & $check.command[0] $check.command[1..($check.command.Count - 1)] 2>&1
        $ErrorActionPreference = $previousErrorActionPreference
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 0 }
        $durationMs = [int]((Get-Date) - $started).TotalMilliseconds

        $status = if ($exitCode -eq 0) { "passed" } else { "failed" }
        $results += [ordered]@{
            id = $check.id
            name = $check.name
            status = $status
            exitCode = $exitCode
            durationMs = $durationMs
            output = ($output | Out-String).Trim()
        }

        if ($exitCode -ne 0 -and -not $ContinueOnFailure) {
            break
        }
    }

    $passed = @($results | Where-Object { $_.status -eq "passed" }).Count
    $failed = @($results | Where-Object { $_.status -ne "passed" }).Count
    $score = if ($results.Count -eq 0) { 0 } else { [math]::Round(($passed / $results.Count) * 100) }
    $verdict = if ($score -ge 90) {
        "pass"
    } elseif ($score -ge 80) {
        "internal-trial"
    } elseif ($score -ge 70) {
        "demo-only"
    } else {
        "stop-feature-work"
    }

    $report = [ordered]@{
        generatedAt = (Get-Date).ToString("s")
        mode = $Mode
        score = $score
        verdict = $verdict
        passed = $passed
        failed = $failed
        results = $results
    }

    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $LatestJson -Encoding UTF8

    $md = @()
    $md += "# Harness Report"
    $md += ""
    $md += ("- Mode: ``{0}``" -f $Mode)
    $md += "- Score: $score"
    $md += ("- Verdict: ``{0}``" -f $verdict)
    $md += "- Passed: $passed"
    $md += "- Failed: $failed"
    $md += ""
    $md += "## Checks"
    foreach ($result in $results) {
        $md += ""
        $md += "### $($result.id) - $($result.name)"
        $md += ""
        $md += ("- Status: ``{0}``" -f $result.status)
        $md += "- Duration: $($result.durationMs)ms"
        if ($result.output) {
            $md += ""
            $md += '```text'
            $md += $result.output
            $md += '```'
        }
    }
    $md -join [Environment]::NewLine | Set-Content -Path $LatestMd -Encoding UTF8

    Write-Host "Harness score: $score ($verdict)"
    Write-Host "Report: $LatestMd"
    if ($failed -gt 0) { exit 1 }
}
finally {
    Pop-Location
}
