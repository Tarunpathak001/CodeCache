# /scripts/install-service.ps1
# Purpose: Installs and starts CodeCache Pro as a Windows service using NSSM.
# Must be run with Administrator privileges.

#Requires -RunAsAdministrator

Param(
    [string]$ServiceName = "CodeCachePro",
    [string]$NssmUrl = "https://nssm.cc/release/nssm-2.24.zip",
    [string]$NssmZipFileName = "nssm.zip"
)

# --- Configuration ---
$ProjectRoot = (Get-Item -Path ".\").Parent.FullName
$NssmDir = Join-Path $ProjectRoot "scripts\nssm"
$NssmExePath = Join-Path $NssmDir "nssm.exe"
$BackendDir = Join-Path $ProjectRoot "backend"
$CliDir = Join-Path $ProjectRoot "cli"
$WrapperScriptPath = Join-Path $ProjectRoot "scripts\wrapper.ps1"
$NodeExePath = (Get-Command node).Source
if (Test-Path "$BackendDir\.env") {
    $Port = (Get-Content "$BackendDir\.env" | Where-Object { $_ -match "^PORT=" } | ForEach-Object { $_.Split('=')[1] })
} else {
    Write-Host "Warning: .env file not found at $BackendDir\.env, using default port 5050" -ForegroundColor Yellow
    $Port = "5050"
}

Write-Host "--- CodeCache Pro Service Installer ---" -ForegroundColor Yellow
Write-Host "Project Root: $ProjectRoot"
Write-Host "Backend Path: $BackendDir"
Write-Host "Node.js Path: $NodeExePath"
Write-Host "Service Name: $ServiceName"
Write-Host "Port: $Port"

# --- Step 1: Check Prerequisites ---
if (-not $NodeExePath) {
    Write-Error "Node.js is not found in your PATH. Please install it and try again."
    Exit 1
}

# --- Step 2: Download and Extract NSSM (Non-Sucking Service Manager) ---
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
        Write-Error "Failed to download or extract NSSM. Please check your internet connection or download it manually to $NssmDir. Error: $_"
        Exit 1
    }
} else {
    Write-Host "NSSM found at $NssmExePath" -ForegroundColor Green
}

# --- Step 3: Install Dependencies ---
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
if (Test-Path "$BackendDir\package.json") {
    Set-Location $BackendDir
    npm install
    Set-Location $ProjectRoot\scripts
} else {
    Write-Error "Backend package.json not found at $BackendDir\package.json"
    Exit 1
}

Write-Host "Installing CLI dependencies and linking..." -ForegroundColor Cyan
if (Test-Path "$CliDir\package.json") {
    Set-Location $CliDir
    npm install
    npm link
    Set-Location $ProjectRoot\scripts
} else {
    Write-Host "CLI package.json not found at $CliDir\package.json, skipping CLI installation" -ForegroundColor Yellow
}

# --- Step 4: Configure and Install Service ---
Write-Host "Installing Windows Service '$ServiceName'..." -ForegroundColor Cyan

# Remove existing service if it exists, to ensure a clean install
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Service '$ServiceName' already exists. Removing it first." -ForegroundColor Yellow
    & $NssmExePath remove $ServiceName confirm
    Start-Sleep -Seconds 2
}

& $NssmExePath install $ServiceName powershell.exe "-ExecutionPolicy Bypass -File `"$WrapperScriptPath`""
& $NssmExePath set $ServiceName AppDirectory $BackendDir
& $NssmExePath set $ServiceName AppStopMethodSkip 6
& $NssmExePath set $ServiceName Start SERVICE_AUTO_START
& $NssmExePath set $ServiceName Description "CodeCache Pro package caching proxy service."

# --- Step 5: Configure Windows Firewall ---
Write-Host "Configuring Windows Firewall to allow traffic on port $Port..." -ForegroundColor Cyan
$RuleName = "CodeCachePro Port $Port"
$rule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if ($rule) {
    Write-Host "Firewall rule '$RuleName' already exists." -ForegroundColor Yellow
} else {
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port
    Write-Host "Firewall rule created." -ForegroundColor Green
}

# --- Step 6: Start the Service ---
Write-Host "Starting service '$ServiceName'..." -ForegroundColor Cyan
& $NssmExePath start $ServiceName

# --- Final Check ---
Start-Sleep -Seconds 3
$serviceStatus = (Get-Service -Name $ServiceName).Status
if ($serviceStatus -eq "Running") {
    Write-Host "✅ Service '$ServiceName' installed and started successfully!" -ForegroundColor Green
    Write-Host "Your cache server is now running at http://localhost:$Port"
} else {
    Write-Error "❌ Service '$ServiceName' failed to start. Status: $serviceStatus. Check logs for details."
    Write-Host "You can check logs using: & '$NssmExePath' edit $ServiceName"
}