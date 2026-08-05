# Приводит записанный из браузера ролик к обычному MP4.
#
# Зачем это нужно. promo.html и promo-vertical.html пишут видео через MediaRecorder,
# и тот всегда отдаёт ФРАГМЕНТИРОВАННЫЙ MP4: маленький moov без таблиц сэмплов, а дальше
# десятки пар moof+mdat. На компьютере такой файл играет нормально, поэтому проблему легко
# не заметить, но iPhone его не импортирует, и соцсети при загрузке с телефона часто
# отказываются его принимать. Сами кодеки при этом правильные (H.264 + AAC, yuv420p) —
# ломается только структура контейнера, поэтому чинится она пересборкой без перекодирования.
#
# Скрипт делает из одного файла два:
#   *-fixed.mp4  — та же картинка и звук бит-в-бит, просто нормальный контейнер:
#                  moov в начале файла (faststart), один mdat, видеодорожка первой
#                  (MediaRecorder ставит первой звуковую, что смущает строгие импортёры).
#   *-phone.mp4  — пережатая версия ~15 МБ вместо ~65 МБ. Нужна, чтобы файл прошёл через
#                  мессенджер и быстро залился с телефона. Соцсети всё равно жмут видео
#                  у себя, так что терять качество на этом шаге почти не на чем.
#
# Использование:
#   .\fix-video.ps1 "C:\путь\neura-reklama-9x16.mp4"
#   .\fix-video.ps1 "C:\путь\видео.mp4" -OnlyFixed     # без пережатой версии

param(
  [Parameter(Mandatory = $true)]
  [string]$Path,

  # Пропустить создание облегчённой версии — если нужен только исправленный контейнер.
  [switch]$OnlyFixed
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Path)) {
  Write-Error "Файл не найден: $Path"
  exit 1
}

# ffmpeg ставится через `winget install Gyan.FFmpeg`. После установки он не всегда сразу
# виден в PATH текущей сессии, поэтому если в PATH его нет — ищем в папке пакетов winget.
function Get-Ffmpeg([string]$exeName) {
  $cmd = Get-Command $exeName -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $pkgRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  if (Test-Path $pkgRoot) {
    $found = Get-ChildItem -Path $pkgRoot -Filter "$exeName.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  return $null
}

$ffmpeg = Get-Ffmpeg 'ffmpeg'
if (-not $ffmpeg) {
  Write-Error "ffmpeg не найден. Установите: winget install --id Gyan.FFmpeg -e"
  exit 1
}

$item = Get-Item $Path
$dir = $item.DirectoryName
$base = [System.IO.Path]::GetFileNameWithoutExtension($item.Name)

$fixed = Join-Path $dir "$base-fixed.mp4"
$phone = Join-Path $dir "$base-phone.mp4"

$sizeMb = { param($p) [math]::Round((Get-Item $p).Length / 1MB, 1) }

Write-Host "Исходник: $($item.Name) ($(& $sizeMb $item.FullName) МБ)"

# --- 1. Пересборка контейнера. -c copy = без перекодирования, качество не теряется.
#        -map 0:v:0 -map 0:a:0 заодно ставит видео первой дорожкой.
Write-Host "Пересобираю контейнер…"
& $ffmpeg -y -loglevel error -i $item.FullName `
  -map 0:v:0 -map 0:a:0 -c copy -movflags +faststart $fixed
if ($LASTEXITCODE -ne 0) { Write-Error "ffmpeg не смог пересобрать контейнер"; exit 1 }
Write-Host "  готово: $([System.IO.Path]::GetFileName($fixed)) ($(& $sizeMb $fixed) МБ)"

if ($OnlyFixed) { exit 0 }

# --- 2. Облегчённая версия. High profile + level 4.1 — берут все телефоны последних лет.
#        CRF 21 даёт визуально ту же картинку при кратно меньшем размере: в ролике много
#        тёмного фона и плоских заливок, они жмутся очень хорошо.
Write-Host "Делаю облегчённую версию для телефона…"
& $ffmpeg -y -loglevel error -i $fixed `
  -c:v libx264 -profile:v high -level 4.1 -pix_fmt yuv420p -crf 21 -preset medium `
  -c:a aac -b:a 128k -movflags +faststart $phone
if ($LASTEXITCODE -ne 0) { Write-Error "ffmpeg не смог пережать видео"; exit 1 }
Write-Host "  готово: $([System.IO.Path]::GetFileName($phone)) ($(& $sizeMb $phone) МБ)"

Write-Host ""
Write-Host "На телефон и в соцсети — берите *-phone.mp4."
Write-Host "Максимальное качество (для монтажа, YouTube) — *-fixed.mp4."
