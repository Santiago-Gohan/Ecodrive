@echo off
rem ========================================================
rem  EcoDrive: túnel Cloudflare persistente (wrapper .cmd)
rem  Lo lanza el Programador de tareas => sobrevive al cierre
rem  de cualquier shell interactivo.
rem ========================================================

set LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\tunel_persistente_v5.err.log
del /q "%LOG%" 2>nul

set "UIURL=http://localhost:3000"

rem --- 1) Si cloudflared ya corre, no duplicar ---
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if not errorlevel 1 goto :ya_corre

rem --- 2) Lanzar en segundo plano y volcar error a LOG ---
start "EcoDriveTunel" /b cloudflared.exe tunnel --url "%UIURL%" 2> "%LOG%"

:ya_corre
exit /b 0
