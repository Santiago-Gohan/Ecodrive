@echo off
set LOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\eco_tunel.log
set URLF=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\eco_url.txt
set TMPF=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\eco_tmp.txt
del /q "%LOG%" "%URLF%" "%TMPF%" 2>nul

REM ---- backend node ----
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul
if errorlevel 1 (
  start "" /B "C:\Program Files\nodejs\node.exe" src\server.js
)

REM ---- tunel cloudflared (solo si no esta vivo) ----
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if not errorlevel 1 goto :tunel_vivo
start "" /B "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000 --logfile "%LOG%"
:tunel_vivo

REM ---- esperar y capturar la URL del log ----
timeout /t 18 /nobreak >nul
if exist "%LOG%" (
  findstr /i "https://.*trycloudflare\.com" "%LOG%" > "%TMPF%" 2>nul
  if exist "%TMPF%" (
    set /p URL=<"%TMPF%"
    echo %URL%> "%URLF%"
  )
)
del /q "%TMPF%" 2>nul
