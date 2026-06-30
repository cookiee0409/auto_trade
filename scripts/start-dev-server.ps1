$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$node = (Get-Command node.exe -ErrorAction Stop).Source
$next = Join-Path $root "node_modules\next\dist\bin\next"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$log = Join-Path $root ".next-dev-$stamp.log"
$err = Join-Path $root ".next-dev-$stamp.err.log"

Set-Location $root
& $node $next dev -p 3000 1>> $log 2>> $err
