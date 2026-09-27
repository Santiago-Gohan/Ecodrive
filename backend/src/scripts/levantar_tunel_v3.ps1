# levantar_tunel_v3.ps1 - Inicia cloudflared si hace falta y guarda su URL en JSON.
# NO mata procesos: respeta un túnel ya activo. Se ejecuta como tarea programada
# (proceso desacoplado que sobrevive al cierre del shell), por eso va con -File.
$ErrorActionPreference = "SilentlyContinue"

$dirDatos = "C:\Users\SANTIAGO\AppData\Local\Temp\opencode\opencode"
New-Item -ItemType Directory -Path $dirDatos -Force | Out-Null
$err = Join-Path $dirDatos "tunel_v3.CloudFlarePlayer.err.log"
$json = Join-Path $dirDatos "tunel_v3.url.json"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 1) Si ya corre, recupera su URL del log (no reiniciar)
$procs = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($procs) {
  $m = Select-String -Path $err -Pattern "https://[a-z0-9\-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -Last 1
  if ($m) {
    $url = $m.Matches[0].Value
    @{fecha=(Get-Date -Format o); url=$url; origen="ya-corria"} | ConvertTo-Json | Set-Content $json -Encoding UTF8
    Write-Output "URL ya existente: $url"
    exit 0
  }
}

# 2) Arranca uno nuevo con log
Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --url http://localhost:3000" -RedirectStandardError $err -WindowStyle Hidden

# 3) Espera hasta 60 s a que aparezca la URL en el log
$url = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  $m = Select-String -Path $err -Pattern "https://[a-z0-9\-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -Last 1
  if ($m) { $url = $m.Matches[0].Value; break }
}

if ($url) {
  @{fecha=(Get-Date -Format o); url=$url; origen="nuevo"} | ConvertTo-Json | Set-Content $json -Encoding UTF8
  Write-Output "URL nueva: $url"
} else {
  @{fecha=(Get-Date -Format o); url=$null; origen="sin-url"} | ConvertTo-Json | Set-Content $json -Encoding UTF8
  Write-Output "Aun sin URL (revisar log)."
}
