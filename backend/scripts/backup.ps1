<#
  EcoDrive - Backup de la base de datos (pg_dump).
  Uso:
    powershell -File scripts\backup.ps1         -> backup LOCAL (usa DATABASE_URL del .env)
    powershell -File scripts\backup.ps1 -Nube   -> backup de Neon (usa DATABASE_URL_NUBE)
  Salida: backend\backups\ecodrive_YYYY-MM-DD_HHmmss.sql (conserva los últimos 15).
#>
[CmdletBinding()]
param(
  [switch]$Nube,
  [string]$Destino = '',
  [string]$PgDump = ''
)

$ErrorActionPreference = 'Stop'
$backendDir = Split-Path $PSScriptRoot -Parent

$dbUri = ''
if (Test-Path (Join-Path $backendDir '.env')) {
  Get-Content (Join-Path $backendDir '.env') | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$') {
      $clave = $matches[1]
      $valor = $matches[2] -replace '^"|"$', ''
      if ($Nube -and $clave -eq 'DATABASE_URL_NUBE') { $dbUri = $valor }
      if (-not $Nube -and $clave -eq 'DATABASE_URL') { $dbUri = $valor }
    }
  }
}

$pgDump = $PgDump
if (-not $pgDump) {
  foreach ($ver in @('19', '18', '17', '16')) {
    $candidato = "C:\Program Files\PostgreSQL\$ver\bin\pg_dump.exe"
    if (Test-Path $candidato) { $pgDump = $candidato; break }
  }
}
if (-not $pgDump) { throw 'No hay pg_dump instalado (busque en C:\Program Files\PostgreSQL).' }
if (-not (Test-Path $pgDump)) { throw "No encuentro pg_dump en $pgDump (ajusta el param -PgDump)." }
if (-not $dbUri) { throw 'No hay conexión configurada. Revisa DATABASE_URL (o DATABASE_URL_NUBE con -Nube) en backend\.env' }

$verCliente = (& $pgDump --version) -replace '.*?(\d+)\..*', '$1'
if ($Nube -and [int]$verCliente -lt 18) {
  throw "Neon corre PostgreSQL 18 pero el pg_dump local es $verCliente. `n  Instala el binario de PostgreSQL 18 (solo pg_dump) y usa -PgDump 'ruta\pg_dump.exe'."
}

$dir = if ($Destino) { Join-Path $backendDir $Destino } else { Join-Path $backendDir 'backups' }
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$fecha = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$archivo = Join-Path $dir "ecodrive_$fecha.sql"

$etiqueta = if ($Nube) { 'Nube (Neon)' } else { 'Local' }
Write-Host "Backup $etiqueta -> $archivo"
& $pgDump "--dbname=$dbUri" -f $archivo
if ($LASTEXITCODE -ne 0) { throw 'pg_dump fallo. Verifica la conexion o la URL.' }

Get-ChildItem $dir -Filter 'ecodrive_*.sql' |
  Sort-Object Name -Descending |
  Select-Object -Skip 15 |
  Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "Backup OK: $archivo"