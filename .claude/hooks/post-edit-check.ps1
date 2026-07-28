$ErrorActionPreference = 'Stop'

$projectRoot = [string]$env:CLAUDE_PROJECT_DIR
if ([string]::IsNullOrWhiteSpace($projectRoot) -or -not (Test-Path -LiteralPath $projectRoot)) {
    [Console]::Error.WriteLine('Lightweight check skipped: CLAUDE_PROJECT_DIR is unavailable.')
    exit 0
}

Push-Location -LiteralPath $projectRoot
try {
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $diffCheck = & git diff --check 2>&1
    $ErrorActionPreference = $previousErrorPreference
    if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine('Lightweight check found whitespace errors:')
        foreach ($line in $diffCheck) {
            [Console]::Error.WriteLine([string]$line)
        }
        exit 2
    }

    $settingsPath = Join-Path $projectRoot '.claude\settings.json'
    if (Test-Path -LiteralPath $settingsPath) {
        try {
            Get-Content -LiteralPath $settingsPath -Raw |
                ConvertFrom-Json -ErrorAction Stop |
                Out-Null
        } catch {
            [Console]::Error.WriteLine('Lightweight check found invalid .claude/settings.json.')
            exit 2
        }
    }
} finally {
    Pop-Location
}

exit 0
