@echo off
rem ================================================================
rem  EcoDrive: levantar backend Node persistente (tarea programada)
rem  Reutiliza el MISMO patron que funciono para el tunel v4:
rem  Start-Process oculto + log propio + tarea schtasks.
rem ================================================================

set BIN=C:\Program Files\nodejs\node.exe
set SM="C:\Users\SANTIAGO\Documents\EcoDrive\backend\src\server.js"
set LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\opencode\backend_v4_err.log
set FLAG=C:\Users\SANTIAGO\Documents\EcoDrive\backend\src\scripts\backend_v4_.arranco.flag

del /q "%LOG%" 2>nul
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul
if not errorlevel 1 goto :ya
start "" /min cmd /c "cd /d C:\Users\SANTIAGO\Documents\EcoDrive\backend && "%BIN%" src\server.js 1>"%LOG%" 2>&1 "
:ya
echo listo > "%FLAG%"
exit /b 0
