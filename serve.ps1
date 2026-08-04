$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8791/")
$listener.Start()
Write-Host "Serving $root on http://localhost:8791/"

$mime = @{
  ".html"="text/html"; ".css"="text/css"; ".js"="application/javascript";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".svg"="image/svg+xml";
  ".mp3"="audio/mpeg"; ".m4a"="audio/mp4"; ".wav"="audio/wav";
  ".webm"="video/webm"; ".mp4"="video/mp4"; ".json"="application/json"
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $req = $context.Request
  $res = $context.Response
  $path = $req.Url.LocalPath
  if ($path -eq "/") { $path = "/index.html" }
  $filePath = Join-Path $root ($path.TrimStart("/"))
  if (Test-Path $filePath -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($filePath)
    $ct = $mime[$ext]
    if (-not $ct) { $ct = "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $total = $bytes.Length

    # Отдаём диапазоны байт. Без этого браузер не может перемотать звук или видео,
    # которые ещё не докачал целиком: он сбрасывает currentTime обратно в ноль,
    # и перемотка в плеере урока просто не работает.
    $res.AddHeader("Accept-Ranges", "bytes")
    $range = $req.Headers["Range"]
    $from = 0
    $to = $total - 1

    if ($range -and $range -match "bytes=(\d*)-(\d*)") {
      $s = $matches[1]
      $e = $matches[2]
      if ($s -ne "") {
        $from = [int64]$s
        if ($e -ne "") { $to = [int64]$e }
      } elseif ($e -ne "") {
        # Форма "bytes=-500": последние 500 байт.
        $from = [Math]::Max(0, $total - [int64]$e)
      }
      if ($to -ge $total) { $to = $total - 1 }

      if ($from -gt $to -or $from -ge $total) {
        $res.StatusCode = 416
        $res.AddHeader("Content-Range", "bytes */$total")
        $res.Close()
        continue
      }
      $res.StatusCode = 206
      $res.AddHeader("Content-Range", "bytes $from-$to/$total")
    }

    $len = $to - $from + 1
    $res.ContentType = $ct
    $res.ContentLength64 = $len
    $res.OutputStream.Write($bytes, $from, $len)
  } else {
    $res.StatusCode = 404
  }
  $res.Close()
}
