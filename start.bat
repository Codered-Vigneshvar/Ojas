@echo off
setlocal

echo.
echo  Ojas Clinical Demo -- starting up
echo  ====================================
echo.

set REPO=%~dp0
:: Remove trailing backslash
if "%REPO:~-1%"=="\" set REPO=%REPO:~0,-1%
set VENV=%REPO%\venv

:: ── Check .env ────────────────────────────────────────────────────────────────
if not exist "%REPO%\backend\.env" (
    echo ERROR: backend\.env not found.
    echo Copy the example and fill in your API keys:
    echo   copy backend\.env.example backend\.env
    pause
    exit /b 1
)

:: ── Python venv ───────────────────────────────────────────────────────────────
if not exist "%VENV%" (
    echo Creating Python virtual environment...
    python -m venv "%VENV%"
    if errorlevel 1 (
        echo ERROR: Could not create venv. Make sure Python 3.11+ is installed.
        pause
        exit /b 1
    )
)

echo Installing backend dependencies...
"%VENV%\Scripts\pip" install -q -r "%REPO%\backend\requirements.txt"

:: ── Database setup ────────────────────────────────────────────────────────────
echo Initialising database tables...
cd /d "%REPO%\backend"
"%VENV%\Scripts\python" init_db.py

echo Seeding user account...
"%VENV%\Scripts\python" seed_users.py

:: ── Frontend deps ─────────────────────────────────────────────────────────────
echo Installing frontend dependencies...
cd /d "%REPO%\frontend"
call npm install --silent

:: ── Launch in separate windows ────────────────────────────────────────────────
echo.
echo Starting backend on  http://localhost:8001 ...
start "Ojas Backend" cmd /k "cd /d "%REPO%\backend" && "%VENV%\Scripts\uvicorn" main:app --reload --port 8001"

echo Starting frontend on http://localhost:5173 ...
start "Ojas Frontend" cmd /k "cd /d "%REPO%\frontend" && npm run dev"

echo.
echo ====================================
echo  Both servers are starting.
echo  Open http://localhost:5173
echo  Login: chaithanya / ojas123
echo ====================================
echo.
pause
