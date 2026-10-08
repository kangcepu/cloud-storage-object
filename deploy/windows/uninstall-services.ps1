$ErrorActionPreference = 'Stop'

@('CloudStorageWeb', 'CloudStorageApi') | ForEach-Object {
  $service = Get-Service -Name $_ -ErrorAction SilentlyContinue
  if ($service) {
    if ($service.Status -ne 'Stopped') {
      Stop-Service -Name $_ -Force
    }
    & sc.exe delete $_ | Out-Null
  }
}
