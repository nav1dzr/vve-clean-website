$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot '..\..')
)
$env:CLAUDE_PROJECT_DIR = $projectRoot
$guardPath = Join-Path $PSScriptRoot 'pre-tool-guard.ps1'
$postEditPath = Join-Path $PSScriptRoot 'post-edit-check.ps1'

$cases = @(
    @{ Name = 'allow lint'; Input = '{"tool_name":"PowerShell","tool_input":{"command":"npm run lint"}}'; Expected = 0 },
    @{ Name = 'allow source edit'; Input = '{"tool_name":"Edit","tool_input":{"file_path":"admin/src/pages/Test.tsx"}}'; Expected = 0 },
    @{ Name = 'block direct main push'; Input = '{"tool_name":"PowerShell","tool_input":{"command":"git push origin main"}}'; Expected = 2 },
    @{ Name = 'block force push'; Input = '{"tool_name":"Bash","tool_input":{"command":"git push --force-with-lease origin feature/x"}}'; Expected = 2 },
    @{ Name = 'block hard reset'; Input = '{"tool_name":"PowerShell","tool_input":{"command":"git reset --hard HEAD~1"}}'; Expected = 2 },
    @{ Name = 'block chained clean'; Input = '{"tool_name":"Bash","tool_input":{"command":"npm test && git clean -fd"}}'; Expected = 2 },
    @{ Name = 'block PR merge'; Input = '{"tool_name":"PowerShell","tool_input":{"command":"gh pr merge 5 --merge"}}'; Expected = 2 },
    @{ Name = 'block production deploy'; Input = '{"tool_name":"Bash","tool_input":{"command":"npx vercel --prod"}}'; Expected = 2 },
    @{ Name = 'block migration apply'; Input = '{"tool_name":"PowerShell","tool_input":{"command":"npx supabase migration up"}}'; Expected = 2 },
    @{ Name = 'block protected env edit'; Input = '{"tool_name":"Edit","tool_input":{"file_path":"admin/.env.local"}}'; Expected = 2 },
    @{ Name = 'block protected docs edit'; Input = '{"tool_name":"Write","tool_input":{"file_path":"docs/audit.md"}}'; Expected = 2 }
)

$failed = $false
foreach ($case in $cases) {
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $case.Input |
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $guardPath 2>$null
    $actual = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorPreference
    $passed = $actual -eq $case.Expected
    Write-Host ("{0}: expected {1}, got {2} => {3}" -f
        $case.Name, $case.Expected, $actual, $passed)

    if (-not $passed) {
        $failed = $true
    }
}

Get-Content -LiteralPath (Join-Path $projectRoot '.claude\settings.json') -Raw |
    ConvertFrom-Json -ErrorAction Stop |
    Out-Null
Write-Host 'settings.json: valid'

$guardTokens = $null
$guardErrors = $null
$postTokens = $null
$postErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
    $guardPath,
    [ref]$guardTokens,
    [ref]$guardErrors
) | Out-Null
[System.Management.Automation.Language.Parser]::ParseFile(
    $postEditPath,
    [ref]$postTokens,
    [ref]$postErrors
) | Out-Null

Write-Host "guard parse errors: $($guardErrors.Count)"
Write-Host "post-edit parse errors: $($postErrors.Count)"

$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
'{}' | & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $postEditPath 2>$null
$postEditExit = $LASTEXITCODE
$ErrorActionPreference = $previousErrorPreference
Write-Host "post-edit exit: $postEditExit"

if (
    $failed -or
    $guardErrors.Count -ne 0 -or
    $postErrors.Count -ne 0 -or
    $postEditExit -ne 0
) {
    exit 1
}

Write-Host 'All hook tests passed.'
exit 0
