# /scripts/wrapper.ps1
# Purpose: A simple wrapper script for NSSM. It ensures that 'npm start'
# runs from the correct directory, which is crucial for Node.js applications.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"

Write-Host "Wrapper: Project Root: $ProjectRoot"
Write-Host "Wrapper: Backend Directory: $BackendDir"

if (-not (Test-Path $BackendDir)) {
    Write-Error "Backend directory not found: $BackendDir"
    Exit 1
}

if (-not (Test-Path "$BackendDir\package.json")) {
    Write-Error "package.json not found in: $BackendDir"
    Exit 1
}

Write-Host "Wrapper: Changing directory to $BackendDir"
Set-Location -Path $BackendDir
Write-Host "Wrapper: Executing 'npm start'..."
npm start