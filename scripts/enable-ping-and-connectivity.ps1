# Enable Ping and Full Cross-Device Connectivity for CodeCache Pro
# Run this script as Administrator on the SERVER machine

#Requires -RunAsAdministrator

Write-Host "=== CodeCache Pro Cross-Device Connectivity Setup ===" -ForegroundColor Yellow

$Port = "5050"
$LocalIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"}).IPAddress

Write-Host "Server IP Address: $LocalIP" -ForegroundColor Green
Write-Host "Server Port: $Port" -ForegroundColor Green

# Step 1: Enable ICMP (Ping) through Windows Firewall
Write-Host "`n1. Enabling ICMP (Ping) through Windows Firewall..." -ForegroundColor Cyan
try {
    $PingRule = Get-NetFirewallRule -DisplayName "Allow ICMPv4 Ping" -ErrorAction SilentlyContinue
    if ($PingRule) {
        Write-Host "   ICMP ping rule already exists" -ForegroundColor Yellow
    } else {
        New-NetFirewallRule -DisplayName "Allow ICMPv4 Ping" -Protocol ICMPv4 -IcmpType 8 -Enabled True -Direction Inbound -Action Allow
        Write-Host "   ✅ ICMP ping rule created successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Failed to create ICMP rule: $_" -ForegroundColor Red
}

# Step 2: Enable HTTP traffic on port 5050
Write-Host "`n2. Enabling HTTP traffic on port $Port..." -ForegroundColor Cyan
try {
    $HttpRule = Get-NetFirewallRule -DisplayName "CodeCachePro Port $Port" -ErrorAction SilentlyContinue
    if ($HttpRule) {
        Write-Host "   HTTP rule for port $Port already exists" -ForegroundColor Yellow
    } else {
        New-NetFirewallRule -DisplayName "CodeCachePro Port $Port" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port
        Write-Host "   ✅ HTTP rule for port $Port created successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Failed to create HTTP rule: $_" -ForegroundColor Red
}

# Step 3: Check if server is running
Write-Host "`n3. Checking server status..." -ForegroundColor Cyan
$ServerProcess = netstat -ano | Select-String "0.0.0.0:$Port.*LISTENING"
if ($ServerProcess) {
    Write-Host "   ✅ Server is running and listening on all interfaces" -ForegroundColor Green
} else {
    Write-Host "   ❌ Server is not running on port $Port" -ForegroundColor Red
    Write-Host "   Please start the server with: npm start" -ForegroundColor Yellow
}

# Step 4: Test local connectivity
Write-Host "`n4. Testing local connectivity..." -ForegroundColor Cyan
try {
    $Response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Local HTTP test passed (Status: $($Response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Local HTTP test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Test network connectivity
if ($LocalIP) {
    Write-Host "`n5. Testing network connectivity..." -ForegroundColor Cyan
    try {
        $Response = Invoke-WebRequest -Uri "http://${LocalIP}:${Port}/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   ✅ Network HTTP test passed (Status: $($Response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Network HTTP test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 6: Display configuration for clients
Write-Host "`n=== Client Configuration ===" -ForegroundColor Yellow
Write-Host "Run these commands on CLIENT devices:" -ForegroundColor Cyan
Write-Host ""
Write-Host "# Test ping connectivity:" -ForegroundColor White
Write-Host "ping ${LocalIP}" -ForegroundColor Gray
Write-Host ""
Write-Host "# Test HTTP connectivity:" -ForegroundColor White
Write-Host "curl http://${LocalIP}:${Port}/health" -ForegroundColor Gray
Write-Host ""
Write-Host "# Configure npm to use cache:" -ForegroundColor White
Write-Host "npm config set registry http://${LocalIP}:${Port}/npm" -ForegroundColor Gray
Write-Host ""
Write-Host "# Install packages:" -ForegroundColor White
Write-Host "npm install express" -ForegroundColor Gray
Write-Host "npm install lodash" -ForegroundColor Gray

Write-Host "`n=== Summary ===" -ForegroundColor Yellow
Write-Host "✅ ICMP (Ping) should now work from client devices" -ForegroundColor Green
Write-Host "✅ HTTP traffic on port ${Port} is allowed" -ForegroundColor Green
Write-Host "✅ Clients can now ping and access: ${LocalIP}" -ForegroundColor Green
Write-Host ""
Write-Host "If ping still doesn't work, check:" -ForegroundColor Yellow
Write-Host "- Client device firewall settings" -ForegroundColor White
Write-Host "- Router/network configuration" -ForegroundColor White
Write-Host "- Network adapter settings" -ForegroundColor White