# aims: comprobar en el log el arranque de cloudflared v4 y extraer URL
$enc = New-Object System.Text.Encoding
$enc = [Console]::OutputEncoding
Write-Output ("ENC_INICIAL=" + $enc.EncodingName)
Write-Output ("CP=" + $enc.CodePage)
