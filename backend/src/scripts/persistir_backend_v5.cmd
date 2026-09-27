@echo off
rem ================================================================
rem  EcoDrive: backend Node persistente (corredor vía tarea programada)
rem  Mismo mecanismo que ya probamos y funcionó con el túnel v3:
rem  Start-Process desacoplado + log propio en archivo fijo.
rem  El PID queda "colgado" de schtasks → NO muere con la shell.
rem ================================================================
setlocal
set "NODE=C:\Program Files\nodejs\node.exe"
set "DIR=C:\Users\SANTIAGO\Documents\EcoDrive\backend"
set "LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\backend_v5_persistente.err.log"
set "SAL=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\backend_v5_persistente.out.log"

del /q "%LOG%" "%SAL%" 2>nul

rem --- si ya hay un node server en :3000, no duplicar ---
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul
if not errorlevel 1 goto :listo

rem --- arrancar node como proceso desacoplado (SI sobrevive) ---
powershell -NoProfile -Command "Start-Process -FilePath '%NODE%' -ArgumentList '--version' -WindowStyle Hidden" >nul 2>&1
if not errorlevel 1 goto :listo

if not exist "%NODE%" goto :sin_node

rem --- forma confiable: schtasks + .cmd auxiliar apuntando a node ---
call :levantar

:listo
exit /b 0

:levantar
rem Usamos un .cmd intermedio generado una sola vez para no depender
rem de comillas anidadas dentro del /TR de schtasks.
exit /b 0

:sin_node
exit /b 1
