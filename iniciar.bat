@echo off
title EcoDrive - Panel de Control
cd /d "%~dp0backend"

echo ============================================
echo   EcoDrive - Iniciando sistema...
echo ============================================
echo.

rem Verificar si el servidor ya esta corriendo
curl -s -o nul http://localhost:3000/api/v1/health
if %errorlevel%==0 (
    echo El servidor ya esta activo.
) else (
    echo Iniciando servidor backend...
    start "" /min cmd /c "node src/server.js"
    timeout /t 3 /nobreak > nul
)

echo.
echo   Panel Admin........  http://localhost:3000
echo   Toma Telemetria....  http://localhost:3000/dispositivo/
echo   Login: admin / admin123
echo.
start "" http://localhost:3000
echo Listo! Cierra esta ventana cuando termines.
pause > nul