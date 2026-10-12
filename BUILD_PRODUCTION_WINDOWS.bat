@echo off
setlocal
cd /d "%~dp0"

if not exist backend\.venv\Scripts\python.exe (
  echo Run SETUP_WINDOWS.bat first.
  pause
  exit /b 1
)

cd frontend
call npm install
call npm run build
cd ..

if exist backend\app\static rmdir /s /q backend\app\static
mkdir backend\app\static
xcopy frontend\dist backend\app\static /E /I /Y >nul

cd backend
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
