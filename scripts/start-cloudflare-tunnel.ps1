[CmdletBinding()]
param(
    [int] $TimeoutSeconds = 180,
    [switch] $LegacyCompose
)

$ErrorActionPreference = "Stop"

function Resolve-ComposeCommand {
    if ($LegacyCompose) {
        return @("docker-compose")
    }

    try {
        & docker compose version *> $null
        if ($LASTEXITCODE -eq 0) {
            return @("docker", "compose")
        }
    }
    catch {
        # Fall through to legacy Compose detection.
    }

    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        return @("docker-compose")
    }

    throw "Docker Compose was not found. Install Docker Compose v2 or legacy docker-compose."
}

$script:ComposeCommand = Resolve-ComposeCommand

function Invoke-Compose {
    param([Parameter(Mandatory = $true)][string[]] $Arguments)

    if ($script:ComposeCommand.Count -eq 1) {
        & $script:ComposeCommand[0] @Arguments
    }
    else {
        & $script:ComposeCommand[0] $script:ComposeCommand[1] @Arguments
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose command failed: $($Arguments -join ' ')"
    }
}

function Read-ComposeOutput {
    param([Parameter(Mandatory = $true)][string[]] $Arguments)

    if ($script:ComposeCommand.Count -eq 1) {
        return (& $script:ComposeCommand[0] @Arguments 2>&1 | Out-String)
    }

    return (& $script:ComposeCommand[0] $script:ComposeCommand[1] @Arguments 2>&1 | Out-String)
}

Write-Host "Starting RiskOptima Platform with the Cloudflare quick tunnel profile..."
Invoke-Compose @("--profile", "tunnel", "up", "-d", "--build")

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$urlPattern = "https://[-a-zA-Z0-9]+\.trycloudflare\.com"

Write-Host "Waiting for Cloudflare to create the public URL..."

while ((Get-Date) -lt $deadline) {
    $logs = Read-ComposeOutput @("logs", "--no-color", "tunnel")
    $match = [regex]::Match($logs, $urlPattern)

    if ($match.Success) {
        Write-Host ""
        Write-Host "Cloudflare tunnel URL: $($match.Value)"
        Write-Host ""
        Write-Host "Follow live tunnel logs with:"
        if ($script:ComposeCommand.Count -eq 1) {
            Write-Host "docker-compose logs -f tunnel"
        }
        else {
            Write-Host "docker compose logs -f tunnel"
        }
        exit 0
    }

    Start-Sleep -Seconds 2
}

Write-Warning "Timed out before Cloudflare printed a tunnel URL."
Write-Host "Recent tunnel logs:"
Read-ComposeOutput @("logs", "--tail", "100", "tunnel") | Write-Host
exit 1
