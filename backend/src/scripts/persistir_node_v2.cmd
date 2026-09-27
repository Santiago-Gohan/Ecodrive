@echo off
rem ================================================================
rem  EcoDrive: backend Node persistente (mismo patron que el tunel)
rem  Start-Process desacoplado -> node NO muere con la shell.
rem  stderr -> archivo log.
rem ================================================================
set LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\backend_v5.err.log
set OUT=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\backend_v5.out.log

tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul
if not errorlevel 1 goto :corriendo

powershell -NoProfile -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'C:\Users\SANTIAGO\Documents\EcoDrive\backend\src\server.js' -WorkingDirectory 'C:\Users\SANTIAGO\Documents\EcoDrive\backend' -WindowStyle Hidden"
:corriendo
exit /b 0
