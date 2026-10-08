param(
  [Parameter(Mandatory = $true)]
  [string]$ApplicationRoot,
  [Parameter(Mandatory = $true)]
  [ValidateSet('api', 'web')]
  [string]$Target,
  [Parameter(Mandatory = $true)]
  [string]$NodePath
)

$ErrorActionPreference = 'Stop'

if ($Target -eq 'api') {
  Set-Location $ApplicationRoot
  & $NodePath (Join-Path $ApplicationRoot 'dist\main.js')
} else {
  $frontendRoot = Join-Path $ApplicationRoot 'frontend'
  Set-Location $frontendRoot
  & $NodePath (Join-Path $frontendRoot 'node_modules\next\dist\bin\next') 'start' '-p' '3001'
}
