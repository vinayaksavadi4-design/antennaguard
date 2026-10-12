@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo AntennaGuard - Windows setup
echo ========================================

python --version >nul 2>&1
if errorlevel 1 (
  echo Python is not available on PATH.
  echo Install Python 3.14 from https://www.python.org/downloads/ and enable Add Python to PATH.
  pause
  exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js is not available on PATH.
  echo Install Node.js 22 LTS from https://nodejs.org/
  pause
  exit /b 1
)

cd backend
if not exist .venv (
  echo Creating Python virtual environment...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cd ..\frontend
call npm install
cd ..

echo.
echo Setup complete.
echo Start the project with START_WINDOWS.bat
pause
