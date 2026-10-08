param(
  [string]$ApplicationRoot = 'C:\cloud-storage',
  [string]$NodePath = (Get-Command node -ErrorAction Stop).Source
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path (Join-Path $ApplicationRoot 'dist\main.js'))) {
  throw "API belum dibangun di $ApplicationRoot. Jalankan npm ci dan npm run build terlebih dahulu."
}
if (-not (Test-Path (Join-Path $ApplicationRoot 'frontend\node_modules\next\dist\bin\next'))) {
  throw "Frontend belum dibangun di $ApplicationRoot\frontend. Jalankan npm ci dan npm run build terlebih dahulu."
}

$runner = Join-Path $ApplicationRoot 'deploy\windows\run-service.ps1'
$powerShell = Join-Path $PSHOME 'powershell.exe'

@(
  @{ Name = 'CloudStorageApi'; Target = 'api'; DisplayName = 'Cloud Storage API' },
  @{ Name = 'CloudStorageWeb'; Target = 'web'; DisplayName = 'Cloud Storage Web' }
) | ForEach-Object {
  if (Get-Service -Name $_.Name -ErrorAction SilentlyContinue) {
    throw "Service $($_.Name) sudah ada. Hapus terlebih dahulu atau gunakan nama lain."
  }
  $binaryPath = "`"$powerShell`" -NoProfile -ExecutionPolicy Bypass -File `"$runner`" -ApplicationRoot `"$ApplicationRoot`" -Target $($_.Target) -NodePath `"$NodePath`""
  New-Service -Name $_.Name -DisplayName $_.DisplayName -BinaryPathName $binaryPath -StartupType Automatic
  & sc.exe failure $_.Name reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
  Start-Service -Name $_.Name
}
