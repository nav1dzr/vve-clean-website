$ErrorActionPreference = 'Stop'

try {
    $inputJson = [Console]::In.ReadToEnd()
    $event = $inputJson | ConvertFrom-Json -ErrorAction Stop
} catch {
    [Console]::Error.WriteLine('Blocked: the safety hook could not parse its input.')
    exit 2
}

$toolName = [string]$event.tool_name
$toolInput = $event.tool_input
$projectRoot = [System.IO.Path]::GetFullPath([string]$env:CLAUDE_PROJECT_DIR)

function Stop-UnsafeAction {
    param([string]$Reason)

    [Console]::Error.WriteLine("Blocked by VVE Clean safety policy: $Reason")
    exit 2
}

function Test-ProtectedPath {
    param([string]$Candidate)

    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $false
    }

    $normalised = $Candidate.Replace('/', '\')
    if (-not [System.IO.Path]::IsPathRooted($normalised)) {
        $normalised = Join-Path $projectRoot $normalised
    }

    try {
        $fullPath = [System.IO.Path]::GetFullPath($normalised)
    } catch {
        return $true
    }

    $rootPrefix = $projectRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $false
    }

    $relative = $fullPath.Substring($rootPrefix.Length).Replace('/', '\')
    return (
        $relative -match '^(?:admin\\)?\.env(?:\.|$)' -or
        $relative -match '^(?:\.playwright-mcp|admin\\scripts|docs)(?:\\|$)' -or
        $relative -eq 'scripts\check-crm-readiness.mjs'
    )
}

if ($toolName -in @('Write', 'Edit')) {
    $filePath = [string]$toolInput.file_path
    if (Test-ProtectedPath $filePath) {
        Stop-UnsafeAction "writing protected path '$filePath' requires Navid's explicit approval."
    }
    exit 0
}

if ($toolName -notin @('Bash', 'PowerShell')) {
    exit 0
}

$command = [string]$toolInput.command
if ([string]::IsNullOrWhiteSpace($command)) {
    exit 0
}

$blockedPatterns = @(
    @{ Pattern = '(?i)(?:^|[;&|]\s*)git\s+push\b.*(?:--force(?:-with-lease)?|-f\b)'; Reason = 'force-pushing is prohibited.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)git\s+push\b[^\r\n;&|]*\b(?:main|HEAD:main)\b'; Reason = 'direct pushes to main are prohibited.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)git\s+reset\s+--hard\b'; Reason = 'git reset --hard is destructive.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)git\s+clean\b'; Reason = 'git clean can delete protected untracked work.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)git\s+(?:branch\s+-[dD]\s+main\b|checkout\s+main\b|switch\s+main\b)'; Reason = 'agents must not change or delete main directly.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)gh\s+pr\s+merge\b'; Reason = 'pull-request merges require Navid.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)(?:npx\s+)?vercel\b.*(?:--prod(?:uction)?\b|\bdeploy\b)'; Reason = 'production deployment requires Navid.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)(?:npx\s+)?supabase\s+(?:db\s+(?:push|reset)|migration\s+up|link|projects?\s+(?:create|delete))\b'; Reason = 'Supabase mutations require Navid.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)(?:npx\s+)?stripe\s+(?:trigger|listen|login|config|resources?)\b'; Reason = 'Stripe operations require Navid.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)(?:rm\s+-rf|Remove-Item\b[^\r\n;&|]*\s-(?:Recurse|Force)\b)'; Reason = 'recursive or forced deletion requires Navid.' },
    @{ Pattern = '(?i)(?:^|[;&|]\s*)(?:del|erase|rmdir|rd)\b'; Reason = 'filesystem deletion requires Navid.' }
)

foreach ($rule in $blockedPatterns) {
    if ($command -match $rule.Pattern) {
        Stop-UnsafeAction $rule.Reason
    }
}

exit 0
