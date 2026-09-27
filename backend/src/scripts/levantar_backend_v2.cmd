@echo off
rem ================================================================
rem  EcoDrive Backend persistente (wrapper cmd v2)
rem  Corrido por schtasks => node NO muere al cerrar el shell agente.
rem  Log hacia archivo fijo para poder leerlo.
rem ================================================================
set NODE=C:\Program Files\nodejs\node.exe
set DIR=C:\Users\SANTIAGO\Documents\EcoDrive\backend
set LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\backend_v4_node.err.log
set OUT=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\backend_v4_node.out.log

tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul
if not errorlevel 1 goto :listo

start "" /min cmd /c "cd /d "%DIR%" && "%NODE%" src\server.js 1>>"%OUT%" 2>>"%LOG%""

:listo
exit /b 0
