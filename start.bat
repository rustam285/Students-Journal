@echo off
chcp 65001 >nul
title Students Journal
cd /d "%~dp0"

echo ================================================
echo   Students Journal
echo   Запуск приложения со встроенной БД PostgreSQL
echo ================================================
echo.

REM Первый запуск: установка зависимостей (включая бинарники PostgreSQL)
if not exist "node_modules" (
    echo [1/2] Первый запуск: устанавливаю зависимости, подожди...
    call pnpm install
    if errorlevel 1 (
        echo.
        echo [X] Ошибка установки зависимостей. Проверь, что установлены Node.js и pnpm.
        pause
        exit /b 1
    )
    echo.
)

echo [2/2] Запускаю приложение...
echo       При первом запуске БД инициализируется автоматически,
echo       при наличии старой SQLite-БД данные переносятся сами.
echo.
echo       Открыть в браузере: http://localhost:3000
echo       Остановка: Ctrl+C в этом окне.
echo.

call pnpm dev:all

echo.
echo Приложение остановлено. Данные сохранены в папке pgdata.
pause
