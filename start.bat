@echo off
setlocal

echo Ojas dev startup
echo =====================================

:: Start Docker services
echo Starting Docker services...
docker compose -f docker-compose.yml up -d

:: Wait a few seconds for postgres to be ready
timeout /t 5 /nobreak >nul

:: Run migrations
echo =====================================
echo [1/2] Running migrations...
cd apps\api
call uv run alembic upgrade head
if errorlevel 1 (
    echo Migration failed! Make sure uv is installed and dependencies are synced.
    pause
    exit /b %errorlevel%
)

:: Seed dev data
echo [2/2] Seeding dev data...
call uv run python ..\..\scripts\seed_dev_data.py

cd ..\..

echo =====================================
echo Starting API on http://localhost:8000
echo Starting web on http://localhost:5173
echo =====================================

:: Start API in a new window
start "Ojas API" cmd /c "cd apps\api && uv run uvicorn ojas.main:app --reload --host 0.0.0.0 --port 8000"

:: Start Web in a new window
start "Ojas Web" cmd /c "cd apps\web && pnpm dev"

echo Both services started in new windows. Close those windows to stop the servers.
pause
