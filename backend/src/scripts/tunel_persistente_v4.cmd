@echo off
rem tarea programada sobreviviente v4 - sin depender del shell del agente
set LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\tunel_v4_estable.CloudFlarePlayer.err.log
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if not errorlevel 1 goto :ya
start "" /b cloudflared.exe tunnel --url http://localhost:3000 2> "%LOG%"
:ya
rem indica al agente que el arranque sucedio (archivo de senal)
echo ok > "C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\_tunel_v4_senal.flag"
exit /b 0
