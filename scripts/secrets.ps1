# ============================================================
#  EcoDrive - Gestor de credenciales (Windows Credential Manager)
#  Los secretos se guardan cifrados en Windows (DPAPI, por usuario).
#  NUNCA se escriben en el chat ni en el repositorio.
#
#  Uso:
#    .\secrets.ps1 guardar            -> pide los valores en ventanas seguras
#    .\secrets.ps1 guardar Postgres   -> guarda/reemplaza solo esa credencial
#    .\secrets.ps1 listar             -> muestra qué credenciales hay (sin valores)
#    .\secrets.ps1 exportar           -> vuelca a backend\.env (gitignoreado)
#    .\secrets.ps1 borrar             -> elimina todas las de EcoDrive
# ============================================================
param(
  [Parameter(Position = 0)][ValidateSet('guardar', 'listar', 'exportar', 'borrar')]
  [string]$Accion = 'listar',
  [Parameter(Position = 1)][string]$Nombre
)

$ErrorActionPreference = 'Stop'
Import-Module CredentialManager -ErrorAction Stop

# Credenciales del proyecto EcoDrive.
#   Target = nombre logico (prefijo EcoDrive:)
#   User   = usuario por defecto (puedes cambiarlo en la ventana)
#   Env    = variable de entorno destino al exportar (vacio = no exportar)
$Definiciones = @(
  @{ Target = 'EcoDrive:Local';           User = 'postgres';      Env = 'DATABASE_URL';      Desc = 'BD local PostgreSQL (ecodrive)' }
  @{ Target = 'EcoDrive:PostgresAdmin';   User = 'postgres';      Env = '';                  Desc = 'Superusuario postgres local' }
  @{ Target = 'EcoDrive:Neon';            User = 'neondb_owner';  Env = 'DATABASE_URL_NUBE'; Desc = 'BD produccion (Neon)' }
  @{ Target = 'EcoDrive:AdminPanel';      User = 'admin';         Env = 'ADMIN_PASS';        Desc = 'Admin del panel (contrasena)' }
  @{ Target = 'EcoDrive:JWTSecret';       User = 'jwt';           Env = 'JWT_SECRET';        Desc = 'Clave de firma de tokens' }
)

function Get-Def($target) { $Definiciones | Where-Object { $_.Target -eq $target } }

function Guardar($def) {
  Write-Host "`n=== $($def.Target)  ($($def.Desc)) ===" -ForegroundColor Cyan
  $pwd = Read-Host -AsSecureString "  Valor del secreto (usuario sugerido: $($def.User))"
  $user = Read-Host "  Usuario [$($def.User)]"
  if ([string]::IsNullOrWhiteSpace($user)) { $user = $def.User }
  New-StoredCredential -Target $def.Target -UserName $user -SecurePassword $pwd -Persist LocalMachine | Out-Null
  Write-Host "  Guardado en Windows Credential Manager." -ForegroundColor Green
}

switch ($Accion) {
  'guardar' {
    $defs = if ($Nombre) { Get-Def "EcoDrive:$Nombre" } else { $Definiciones }
    if (-not $defs) { throw "No existe la credencial '$Nombre'. Usa: Local, PostgresAdmin, Neon, AdminPanel, JWTSecret" }
    foreach ($d in $defs) { Guardar $d }
  }
  'listar' {
    Write-Host "Credenciales EcoDrive en Windows Credential Manager:" -ForegroundColor Cyan
    foreach ($d in $Definiciones) {
      $c = Get-StoredCredential -Target $d.Target -ErrorAction SilentlyContinue
      if ($c) { Write-Host ("  [OK]      {0}  (usuario: {1})  {2}" -f $d.Target, $c.UserName, $d.Desc) -ForegroundColor Green }
      else    { Write-Host ("  [falta]   {0}  {1}" -f $d.Target, $d.Desc) -ForegroundColor Yellow }
    }
  }
  'exportar' {
    $envPath = Join-Path $PSScriptRoot '..\.env'
    $lineas = @(
      "# Generado por secrets.ps1 el $(Get-Date -Format 'yyyy-MM-dd HH:mm')  (NO subir a git)"
      "PORT=3000"
    )
    foreach ($d in ($Definiciones | Where-Object { $_.Env })) {
      $c = Get-StoredCredential -Target $d.Target -ErrorAction SilentlyContinue
      if ($c) {
        $v = $c.GetNetworkCredential().Password
        $lineas += "$($d.Env)=$v"
      }
    }
    $lineas += "THRESHOLD_ECT=105"
    $lineas += "SEVERIDAD_ALERTA=ALTA"
    $lineas += "TELEMETRIA_RETENCION_DIAS=30"
    $lineas += "PURGA_INTERVALO_MIN=60"
    $lineas += "LIMITE_LECTURAS_MINUTO=2400"
    Set-Content -LiteralPath $envPath -Value $lineas -Encoding UTF8
    Write-Host "Exportado a $envPath (gitignoreado)." -ForegroundColor Green
    Write-Host "Comprueba: git check-ignore backend/.env" -ForegroundColor DarkGray
  }
  'borrar' {
    foreach ($d in $Definiciones) {
      if (Remove-StoredCredential -Target $d.Target -ErrorAction SilentlyContinue) {
        Write-Host "  Eliminada $($d.Target)" -ForegroundColor Yellow
      }
    }
  }
}
