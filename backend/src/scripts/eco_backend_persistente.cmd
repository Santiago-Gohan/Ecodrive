@echo off
rem ========================================================
rem  EcoDrive: servidor backend Node persistente (.cmd)
rem  Convierte el proceso node en hijo de schtasks -> no
rem  muere cuando se cierra el shell del operador.
rem ========================================================

set LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\backend_v2.err.log
set OUTLOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\backend_v2.out.log
del /q "%LOG%" "%OUTLOG%" 2>nul

rem --- si ya corre, salir (no duplicar) ---
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul
if not errorlevel 1 goto :casi_listo

rem --- arrancar node persistentemente ---
start "EcoDriveBackendV2" /min cmd /c "cd /d C:\Users\SANTIAGO\Documents\EcoDrive\backend && node src\server.js 1>""%OUTLOG%"" 2>""%LOG%"" "

:casi_listo
timeout /t 1 /nobreak >nul
exit /b 0
