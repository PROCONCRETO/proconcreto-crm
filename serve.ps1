$port = 8080
$folder = $PSScriptRoot
$cotizacionesDir = Join-Path $folder "cotizaciones-guardadas"
if (!(Test-Path $cotizacionesDir)) { New-Item -ItemType Directory -Path $cotizacionesDir | Out-Null }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Servidor corriendo en http://localhost:$port"
Write-Host "Cotizaciones guardadas en: $cotizacionesDir"

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $path = $req.Url.LocalPath.TrimStart('/')

    # ── POST /guardar-cotizacion ──
    if ($req.HttpMethod -eq 'POST' -and $path -eq 'guardar-cotizacion') {
        try {
            $reader = New-Object System.IO.StreamReader($req.InputStream)
            $body = $reader.ReadToEnd()
            $reader.Close()
            $data = $body | ConvertFrom-Json
            $numero = $data.numero -replace '[^a-zA-Z0-9-]', ''
            $filename = Join-Path $cotizacionesDir "$numero.json"
            $body | Out-File -FilePath $filename -Encoding utf8
            $respJson = '{"ok":true,"archivo":"' + $numero + '.json"}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
            $res.ContentType = 'application/json'
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            $err = '{"ok":false,"error":"' + $_.Exception.Message + '"}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($err)
            $res.StatusCode = 500
            $res.ContentType = 'application/json'
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $res.Close()
        continue
    }

    # ── GET archivos estáticos ──
    if ($path -eq '' -or $path -eq '/') { $path = 'cotizaciones.html' }
    $file = Join-Path $folder $path
    if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        $mime = switch ($ext) {
            '.html' { 'text/html; charset=utf-8' }
            '.css'  { 'text/css' }
            '.js'   { 'application/javascript' }
            '.png'  { 'image/png' }
            '.jpg'  { 'image/jpeg' }
            '.svg'  { 'image/svg+xml' }
            '.json' { 'application/json' }
            default { 'application/octet-stream' }
        }
        $res.ContentType = $mime
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $res.Close()
}
