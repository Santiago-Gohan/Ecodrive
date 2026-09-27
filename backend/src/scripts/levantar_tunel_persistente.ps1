$log = "C:\Users\SANTIAGO\AppData\Local\Temp\opencode\ecotunnel_final.err.log"
Remove-Item $log -ErrorAction SilentlyContinue

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Registrar una tarea programada que arranque cloudflared de forma persistente
# (proceso NO depediente de mi shell -> no muere al cerrar el tool)
schtasks /Create /F /TN "EcoDriveTunnel" /SC ONCE /ST 00:00 `
  /TR "powershell -NoProfile -WindowStyle Hidden -Command `"`$env:Path=([Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User'));`$p=Start-Process -FilePath 'cloudflared' -ArgumentList 'tunnel --url http://localhost:3000' -RedirectStandardError 'C:\Users\SANTIAGO\AppData\Local\Temp\opencode\ecotunnel_final.err.log' -WindowStyle Hidden -PassThru;`$p.Id | Out-File 'C:\Users\SANTIAGO\AppData\Local\Temp\opencode\ecotunnel_pid.txt'`"" | Out-Null

schtasks /Run /TN "EcoDriveTunnel" | Out-Null

# Esperar a que cloudflared genere su URL en el log
$url = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern "https://[a-z0-9\-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value; break }
  }
}
Write-Output "URL==> $url <=="