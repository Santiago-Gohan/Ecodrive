@echo off
rem ========================================================
rem  VUELVE A LEVANTAR cloudflared si se cayó y guarda la URL
rem  en un JSON fijo para poder leerla con la herramienta Read.
rem  Usado por la tarea programada EcoDriveTunelX.
rem ========================================================

set "LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\tunel_v3_estable.CloudFlarePlayer1999.err.log"
set "JSON=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\tunel_v3_estable.url.json"
del /q "%LOG%" 2>nul

rem --- si cloudflared ya está vivo, escribir su URL actual si la hay ---
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if not errorlevel 1 goto :url_existente

start "" /b cmd /c "cloudflared tunnel --url http://localhost:3000 2> "%LOG%""

:url_existente
For /F "delims=" %%U in ('powershell -NoProfile -Command "$m=[regex]::Match((Get-Content -Raw -Path '%LOG%' -ErrorAction SilentlyContinue),'https://[a-z0-9\-]+\.trycloudflare\.com'); if($m.Success){Write-Output $m.Value}else{Write-Output ''}"') Do Set "TUNEL_URL=%%U"
if "%TUNEL_URL%"=="" ( echo {"fecha":"%date% %time%","url":null} > "%JSON%" ) else ( echo {"fecha":"%date% %time%","url":"%TUNEL_URL%"} > "%JSON%" )
exit /b 0
