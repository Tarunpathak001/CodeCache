# /scripts/uninstall-service.ps1
# Purpose: Stops and removes the CodeCache Pro Windows service and firewall rule.
# Must be run with Administrator privileges.

#Requires -RunAsAdministrator

Param(
    [string]$ServiceName = "CodeCachePro",
    [Switch]$StopOnly
)

# --- Configuration ---
$ProjectRoot = (Get-Item -Path ".\").Parent.Parent.FullName
$NssmExePath = Join-Path $ProjectRoot "scripts\nssm\nssm.exe"
$Port = (Get-Content "$ProjectRoot\backend\.env" | Where-Object { $_ -match "^PORT=" } | ForEach-Object { $_.Split('=')[1] })
$RuleName = "CodeCachePro Port $Port"


Write-Host "--- CodeCache Pro Service Uninstaller ---" -ForegroundColor Yellow

if (-not (Test-Path $NssmExePath)) {
    Write-Error "NSSM executable not found at '$NssmExePath'. Cannot proceed."
    Exit 1
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "Service '$ServiceName' is not installed. Nothing to do." -ForegroundColor Green
    Exit 0
}

# --- Stop the Service ---
Write-Host "Stopping service '$ServiceName'..." -ForegroundColor Cyan
& $NssmExePath stop $ServiceName
Start-Sleep -Seconds 2

if ($StopOnly) {
    Write-Host "✅ Service stopped as requested." -ForegroundColor Green
    Exit 0
}

# --- Remove the Service ---
Write-Host "Removing service '$ServiceName'..." -ForegroundColor Cyan
& $NssmExePath remove $ServiceName confirm

# --- Remove Firewall Rule ---
Write-Host "Removing Firewall Rule '$RuleName'..." -ForegroundColor Cyan
$rule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($rule) {
    Remove-NetFirewallRule -DisplayName $RuleName
    Write-Host "Firewall rule removed." -ForegroundColor Green
} else {
    Write-Host "Firewall rule not found." -ForegroundColor Yellow
}

Write-Host "✅ Uninstallation complete." -ForegroundColor Green