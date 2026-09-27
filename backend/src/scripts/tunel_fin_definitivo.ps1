# Tunnel persistente via Programador de tareas -> se mantiene vivo aunque este shell cierre
$e = "C:\Users\SANTIAGO\AppData\Local\Temp\opencode\nuevo_tunel_task.err.log"
try { Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
Remove-Item $e -ErrorAction SilentlyContinue
schtasks /Create /TN "EcoDrive_Tunel_B" /TR "`"C:\Program Files\cloudflared\cloudflared.exe`" tunnel --url http://localhost:3000" /SC ONSTART /F | Out-Null
schtasks /Run /TN "EcoDrive_Tunel_B" | Out-Null
Start-Sleep -Seconds 20
# cloudflared redirige a stderr por defecto; la tarea no captura log -> lanzamos a log propio
Start-Process -FilePath "C:\Program Files\cloudflared\cloudflared.exe" -ArgumentList "tunnel --url http://localhost:3000" -RedirectStandardError $e -WindowStyle Hidden
Write-Output "lanzado,esperando URL..."
