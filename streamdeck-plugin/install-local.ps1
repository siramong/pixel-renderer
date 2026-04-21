$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $root "com.pixelrenderer.localstatus.sdPlugin"
$targetRoot = Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins"
$target = Join-Path $targetRoot "com.pixelrenderer.localstatus.sdPlugin"

if (-not (Test-Path $source)) {
  throw "Source plugin folder not found: $source"
}

if (-not (Test-Path $targetRoot)) {
  New-Item -ItemType Directory -Path $targetRoot | Out-Null
}

if (Test-Path $target) {
  Remove-Item -Recurse -Force $target
}

Copy-Item -Recurse -Force $source $target
Write-Output "Installed plugin to: $target"
Write-Output "Restart Stream Deck app to load changes."
