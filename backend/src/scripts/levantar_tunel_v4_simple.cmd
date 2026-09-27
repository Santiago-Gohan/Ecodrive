@echo off
rem ============================================================
rem  EcoDrive - Túnel cloudflared simple (v4)
rem  Apunta a http://localhost:3000 y ADEMÁS guarda la URL en un
rem  archivo .json para que la lea el agente con Read (sin regex).
rem  Se mantiene vivo mediante tarea programada (schtasks).
rem ============================================================

set DIR=C:\Users\SANTIAGO\Documents\EcoDrive\backend\src\scripts
set ERRLOG=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\opencode\opencode\tunel_v4_persistente.CaballoFuerteDemo.err.log
set URLJSON=C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode\opencode\opencode\tunel_v4_persistente.url.json

del /q "%ERRLOG%" 2>nul
del /q "%URLJSON%" 2>nul

rem --- arrancar cloudflared redirigiendo stderr al archivo de log ---
start "EcoDriveTunelV4" /b cloudflared.exe tunnel --url http://localhost:3000 2> "%ERRLOG%"

rem --- esperar hasta 25 s por la url y escribirla en el JSON ---
setlocal EnableDelayedExpansion
for /l %%i in (1,1,25) do (
  timeout /t 1 /nobreak >nul
  for /f "delims=" %%u in ('findstr /i "https://" "%ERRLOG%"') do (
    echo {"fecha":"%date% %time%","url":"%%u"} > "%URLJSON%"
    goto :fin
  )
)
:fin
endlocal
exit /b 0
