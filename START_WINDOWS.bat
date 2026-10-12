@echo off
setlocal
cd /d "%~dp0"

if not exist backend\.venv\Scripts\python.exe (
  echo Backend virtual environment not found.
  echo Run SETUP_WINDOWS.bat first.
  pause
  exit /b 1
)
if not exist frontend\node_modules (
  echo Frontend dependencies not found.
  echo Run SETUP_WINDOWS.bat first.
  pause
  exit /b 1
)

start "AntennaGuard Backend" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
start "AntennaGuard Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 2 >nul
start "" http://localhost:5173
