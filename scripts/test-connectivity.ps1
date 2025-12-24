# Test CodeCache Pro connectivity
# Run this script to test if the service is working correctly

Write-Host "=== CodeCache Pro Connectivity Test ===" -ForegroundColor Yellow

# Get service status
$ServiceName = "CodeCachePro"
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "Service Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq "Running") { "Green" } else { "Red" })
} else {
    Write-Host "Service not found. Is it installed?" -ForegroundColor Red
}

# Check if port is listening
$Port = "5050"
$Listening = netstat -an | Select-String "0.0.0.0:$Port.*LISTENING"
if ($Listening) {
    Write-Host "✅ Port $Port is listening on all interfaces" -ForegroundColor Green
} else {
    Write-Host "❌ Port $Port is not listening" -ForegroundColor Red
}

# Get local IP
$LocalIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"}).IPAddress
Write-Host "Local IP Address: $LocalIP" -ForegroundColor Cyan

# Test local connectivity
Write-Host "`nTesting local connectivity..." -ForegroundColor Cyan
try {
    $Response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Local connectivity test passed (Status: $($Response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Local connectivity test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test network connectivity
if ($LocalIP) {
    Write-Host "Testing network connectivity..." -ForegroundColor Cyan
    try {
        $Response = Invoke-WebRequest -Uri "http://$LocalIP:$Port" -TimeoutSec 10 -ErrorAction Stop
        Write-Host "✅ Network connectivity test passed (Status: $($Response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "❌ Network connectivity test failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "This might be a firewall issue. Check Windows Firewall settings." -ForegroundColor Yellow
    }
}

# Check firewall rule
$RuleName = "CodeCachePro Port $Port"
$FirewallRule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($FirewallRule) {
    Write-Host "✅ Firewall rule exists and is $($FirewallRule.Enabled)" -ForegroundColor Green
} else {
    Write-Host "❌ Firewall rule not found" -ForegroundColor Red
}

Write-Host "`n=== Configuration for Other Devices ===" -ForegroundColor Yellow
if ($LocalIP) {
    Write-Host "npm config set registry http://$LocalIP:$Port/npm" -ForegroundColor White
    Write-Host "Test URL: http://$LocalIP:$Port" -ForegroundColor White
}