# Combined Dev Start Script for Sniper Sharp Agent
Write-Host "--- Sniper Sharp Agent: Combined Start ---" -ForegroundColor Cyan

$backendPath = Join-Path $PSScriptRoot "backend"
$uiPath = Join-Path $PSScriptRoot "ui"

# 1. Verify Backend Venv
$venvPath = Join-Path $backendPath "venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "Error: Virtual environment not found at $venvPath" -ForegroundColor Red
    Write-Host "Please follow the instructions in README.md to create it first:" -ForegroundColor Yellow
    Write-Host "  cd backend"
    Write-Host "  python -m venv venv"
    Write-Host "  .\venv\Scripts\Activate"
    Write-Host "  pip install -r requirements.txt"
    exit 1
}

# 2. Start Backend
Write-Host "Starting Backend API on port 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\Activate; uvicorn main:app --reload --port 8000"

# 3. Start Frontend
Write-Host "Starting Frontend (Vite) on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ui; npm run dev"

Write-Host "Both services are starting in separate windows." -ForegroundColor Cyan
Write-Host "Monitoring logs in the newly opened windows..." -ForegroundColor Gray
