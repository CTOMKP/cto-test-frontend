# PowerShell script to switch between development and production environments

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "prod")]
    [string]$Environment
)

$envFile = ""

if ($Environment -eq "dev") {
    $envFile = ".env.development.local"
    Write-Host "Switching to development environment (local backend)"
} else {
    $envFile = ".env.local"
    Write-Host "Switching to production environment (Railway backend)"
}

# Copy the selected environment file to .env
Copy-Item -Path $envFile -Destination ".env" -Force

Write-Host "Environment switched to $Environment. Please restart your development server."