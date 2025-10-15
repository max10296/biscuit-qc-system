# ==============================================
# Script: upload_to_github.ps1
# Author: Abdallah
# Purpose: Reinitialize Git repo and force push to GitHub
# ==============================================

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$repoUrl = "https://github.com/max10296/biscuit-qc-system.git"
$projectPath = "C:\Users\abdal\Downloads\biscuit-qc-system-main"

Write-Host "`n=== Starting GitHub Re-Upload Process ===" -ForegroundColor Cyan

# Check Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git not installed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

# Move to project
if (-not (Test-Path $projectPath)) {
    Write-Host "ERROR: Project path not found: $projectPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}
Set-Location $projectPath

# Remove old .git
if (Test-Path ".git") {
    Write-Host "Removing old .git folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".git"
}

# Init repo
Write-Host "Initializing new Git repository..." -ForegroundColor Cyan
git init

# Add all files
Write-Host "Adding all project files..." -ForegroundColor Cyan
git add .

# Commit
Write-Host "Creating first commit..." -ForegroundColor Cyan
git commit -m "Re-upload project with clean files"

# Set branch name
git branch -M main

# Add remote (overwrite if already exists)
if (git remote | Select-String "origin") {
    git remote remove origin
}
git remote add origin $repoUrl

# Push (force)
Write-Host "Pushing to GitHub (force)..." -ForegroundColor Cyan
git push -u origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "Upload successful!" -ForegroundColor Green
    Start-Process $repoUrl
} else {
    Write-Host "Upload failed! Check credentials or repo permissions." -ForegroundColor Red
}

Read-Host "Press Enter to exit"
