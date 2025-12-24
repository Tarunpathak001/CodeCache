# /scripts/install-service-fixed.ps1
# Purpose: Fixed version of the service installer for CodeCache Pro
# Must be run with Administrator privileges from the scripts directory

#Requires -RunAsAdministrator

Param(
    [string]$ServiceName = "CodeCachePro",
    [string]$NssmUrl = "https://nssm.cc/release/nssm-2.24.zip",
    [string]$NssmZipFileName = "nssm.zip"
)

# --- Configuration ---
$ScriptDir = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptDir
$NssmDir = Join-Path $ScriptDir "nssm"
$NssmExePath = Join-Path $NssmDir "nssm.exe"
$BackendDir = Join-Path $ProjectRoot "backend"
$CliDir = Join-Path $ProjectRoot "cli"
$WrapperScriptPath = Join-Path $ScriptDir "wrapper.ps1"
$NodeExePath = (Get-Command node -ErrorAction SilentlyContinue).Source

Write-Host "--- CodeCache Pro Service Installer (Fixed) ---" -ForegroundColor Yellow
Write-Host "Script Directory: $ScriptDir"
Write-Host "Project Root: $ProjectRoot"
Write-Host "Backend Path: $BackendDir"
Write-Host "Node.js Path: $NodeExePath"
Write-Host "Service Name: $ServiceName"

# --- Step 1: Check Prerequisites ---
if (-not $NodeExePath) {
    Write-Error "Node.js is not found in your PATH. Please install it and try again."
    Exit 1
}

if (-not (Test-Path $BackendDir)) {
    Write-Error "Backend directory not found at: $BackendDir"
    Exit 1
}

if (-not (Test-Path "$BackendDir\package.json")) {
    Write-Error "Backend package.json not found at: $BackendDir\package.json"
    Exit 1
}

# Get port from .env file or use default
$Port = "5050"
$EnvFile = Join-Path $BackendDir ".env"
if (Test-Path $EnvFile) {
    $PortLine = Get-Content $EnvFile | Where-Object { $_ -match "^PORT=" }
    if ($PortLine) {
        $Port = $PortLine.Split('=')[1]
    }
}
Write-Host "Port: $Port"

# --- Step 2: Download and Extract NSSM ---
if (-not (Test-Path $NssmExePath)) {
    Write-Host "NSSM not found. Downloading..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $NssmDir | Out-Null
    $NssmZipPath = Join-Path $NssmDir $NssmZipFileName
    
    try {
        Invoke-WebRequest -Uri $NssmUrl -OutFile $NssmZipPath
        Expand-Archive -Path $NssmZipPath -DestinationPath $NssmDir -Force
        # Find the correct nssm.exe for the architecture
        $NssmSourceExe = (Get-ChildItem -Path $NssmDir -Recurse -Filter nssm.exe | Where-Object { $_.FullName -match "win64" } | Select-Object -First 1).FullName
        if ($NssmSourceExe) {
            Copy-Item $NssmSourceExe -Destination $NssmExePath -Force
            Write-Host "NSSM downloaded and extracted successfully." -ForegroundColor Green
        } else {
            throw "Could not find nssm.exe in the downloaded archive."
        }
    } catch {
        Write-Error "Failed to download or extract NSSM: $_"
        Exit 1
    }
} else {
    Write-Host "NSSM found at $NssmExePath" -ForegroundColor Green
}

# --- Step 3: Install Dependencies ---
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Push-Location $BackendDir
try {
    npm install
    Write-Host "Backend dependencies installed successfully." -ForegroundColor Green
} catch {
    Write-Error "Failed to install backend dependencies: $_"
    Pop-Location
    Exit 1
}
Pop-Location

# Install CLI if it exists
if (Test-Path "$CliDir\package.json") {
    Write-Host "Installing CLI dependencies..." -ForegroundColor Cyan
    Push-Location $CliDir
    try {
        npm install
        npm link
        Write-Host "CLI dependencies installed and linked successfully." -ForegroundColor Green
    } catch {
        Write-Host "Warning: Failed to install CLI dependencies: $_" -ForegroundColor Yellow
    }
    Pop-Location
} else {
    Write-Host "CLI directory not found, skipping CLI installation." -ForegroundColor Yellow
}

# --- Step 4: Stop and Remove Existing Service ---
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Stopping existing service '$ServiceName'..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    & $NssmExePath remove $ServiceName confirm
    Start-Sleep -Seconds 2
}

# --- Step 5: Install New Service ---
Write-Host "Installing Windows Service '$ServiceName'..." -ForegroundColor Cyan

# Use Node.js directly instead of PowerShell wrapper for better reliability
$ServerJsPath = Join-Path $BackendDir "src\server.js"
& $NssmExePath install $ServiceName "$NodeExePath" "`"$ServerJsPath`""
& $NssmExePath set $ServiceName AppDirectory $BackendDir
& $NssmExePath set $ServiceName AppStopMethodSkip 6
& $NssmExePath set $ServiceName Start SERVICE_AUTO_START
& $NssmExePath set $ServiceName Description "CodeCache Pro package caching proxy service."

# Set up logging
$LogDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
}
& $NssmExePath set $ServiceName AppStdout (Join-Path $LogDir "service-stdout.log")
& $NssmExePath set $ServiceName AppStderr (Join-Path $LogDir "service-stderr.log")

# --- Step 6: Configure Windows Firewall ---
Write-Host "Configuring Windows Firewall..." -ForegroundColor Cyan
$RuleName = "CodeCachePro Port $Port"
$rule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($rule) {
    Write-Host "Firewall rule '$RuleName' already exists." -ForegroundColor Yellow
} else {
    try {
        New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port
        Write-Host "Firewall rule created successfully." -ForegroundColor Green
    } catch {
        Write-Host "Warning: Failed to create firewall rule: $_" -ForegroundColor Yellow
        Write-Host "You may need to manually allow port $Port through Windows Firewall." -ForegroundColor Yellow
    }
}

# --- Step 7: Start the Service ---
Write-Host "Starting service '$ServiceName'..." -ForegroundColor Cyan
try {
    & $NssmExePath start $ServiceName
    Start-Sleep -Seconds 5
    
    $serviceStatus = (Get-Service -Name $ServiceName).Status
    if ($serviceStatus -eq "Running") {
        Write-Host "✅ Service '$ServiceName' installed and started successfully!" -ForegroundColor Green
        
        # Get local IP for cross-device access
        $LocalIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"}).IPAddress
        
        Write-Host "`n🎉 CodeCache Pro is now running!" -ForegroundColor Green
        Write-Host "Local access: http://localhost:$Port" -ForegroundColor Cyan
        if ($LocalIP) {
            Write-Host "Network access: http://$LocalIP:$Port" -ForegroundColor Cyan
            Write-Host "`nConfigure npm clients with:" -ForegroundColor Yellow
            Write-Host "npm config set registry http://$LocalIP:$Port/npm" -ForegroundColor White
        }
    } else {
        Write-Error "❌ Service '$ServiceName' failed to start. Status: $serviceStatus"
        Write-Host "Check service logs at: $LogDir" -ForegroundColor Yellow
        Write-Host "You can also check service status with: Get-Service $ServiceName" -ForegroundColor Yellow
    }
} catch {
    Write-Error "❌ Failed to start service: $_"
    Write-Host "Check service logs at: $LogDir" -ForegroundColor Yellow
}