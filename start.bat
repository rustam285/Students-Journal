@echo off
chcp 65001 >nul
title Students Journal
cd /d "%~dp0"

echo ================================================
echo   Students Journal
echo   App + embedded PostgreSQL database
echo ================================================
echo.

REM First run: install dependencies (including PostgreSQL binaries)
if not exist "node_modules" (
    echo [1/2] First run: installing dependencies, please wait...
    call pnpm install
    if errorlevel 1 (
        echo.
        echo [X] Dependency install failed. Check that Node.js and pnpm are installed.
        pause
        exit /b 1
    )
    echo.
)

echo [2/2] Starting the application...
echo       First run: database is set up automatically.
echo       Old SQLite data (if configured in .env) migrates automatically.
echo.
echo       Open in browser: http://localhost:3000
echo       Stop: press Ctrl+C in this window.
echo.

call pnpm dev:all

echo.
echo Application stopped. Data is stored in the pgdata folder.
pause
