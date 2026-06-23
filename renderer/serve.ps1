# Launch the Worldline Lite renderer.
# Serves the project root over HTTP (fetch needs http, not file://) and opens the map.
#   Usage:  .\renderer\serve.ps1            # opens the _example run
#           .\renderer\serve.ps1 my-run     # opens runs/my-run
#           .\renderer\serve.ps1 my-run 9000

param(
  [string]$Run  = "_example",
  [int]   $Port = 8000
)

# Project root = parent of this script's folder, regardless of where it's called from.
$root = Split-Path -Parent $PSScriptRoot
$url  = "http://localhost:$Port/renderer/?run=$Run"

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { $python = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $python) {
  Write-Error "Python not found. Install it, or serve the project root with any static server (e.g. 'npx serve') and open $url"
  exit 1
}

Write-Host "Serving $root at $url  (Ctrl+C to stop)" -ForegroundColor Cyan
Start-Process $url
& $python -m http.server $Port --directory $root
