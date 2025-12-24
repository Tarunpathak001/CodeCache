# Fix Cross-Device Connectivity for CodeCache Pro
# Run this script as Administrator

#Requires -RunAsAdministrator

Write-Host "=== CodeCache Pro Cross-Device Fix ===" -ForegroundColor Yellow

# Get current IP address
$LocalIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"}).IPAddress
Write-Host "Local IP Address: $LocalIP" -ForegroundColor Green

# Check if firewall rule exists
$RuleName = "CodeCachePro Port 5050"
$ExistingRule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue

if ($ExistingRule) {
    Write-Host "Firewall rule '$RuleName' already exists." -ForegroundColor Yellow
} else {
    Write-Host "Creating firewall rule for port 5050..." -ForegroundColor Cyan
    try {
        New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5050
        Write-Host "✅ Firewall rule created successfully!" -ForegroundColor Green
    } catch {
        Write-Error "❌ Failed to create firewall rule: $_"
        Write-Host "Please run this script as Administrator or create the rule manually." -ForegroundColor Red
        exit 1
    }
}

# Check if server is running on correct interface
$ServerProcess = netstat -an | Select-String "0.0.0.0:5050.*LISTENING"
if ($ServerProcess) {
    Write-Host "✅ Server is correctly bound to all interfaces (0.0.0.0:5050)" -ForegroundColor Green
} else {
    Write-Host "❌ Server is not running or not bound to all interfaces" -ForegroundColor Red
    Write-Host "Please ensure the server is running with the correct configuration." -ForegroundColor Yellow
}

# Test local connectivity
Write-Host "Testing local connectivity..." -ForegroundColor Cyan
try {
    $Response = Invoke-WebRequest -Uri "http://localhost:5050" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Local connectivity test passed" -ForegroundColor Green
} catch {
    Write-Host "❌ Local connectivity test failed: $_" -ForegroundColor Red
}

Write-Host "`n=== Configuration for Client Devices ===" -ForegroundColor Yellow
Write-Host "Configure npm on other devices with:" -ForegroundColor Cyan
Write-Host "npm config set registry http://$LocalIP:5050/npm" -ForegroundColor White
Write-Host "`nTest access from other devices:" -ForegroundColor Cyan
Write-Host "http://$LocalIP:5050" -ForegroundColor White

Write-Host "`n=== Next Steps ===" -ForegroundColor Yellow
Write-Host "1. Test connectivity from another device on your network" -ForegroundColor White
Write-Host "2. If still having issues, check your router/network configuration" -ForegroundColor White
Write-Host "3. Consider installing as Windows Service using: .\install-service.ps1" -ForegroundColor White