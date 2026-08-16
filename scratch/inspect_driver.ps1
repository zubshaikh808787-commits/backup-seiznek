$exe = (Get-ChildItem -Path ".\scratch\veer_sdk" -Filter "*.exe" -Recurse)[0].FullName
Write-Output "Found: $exe"
$bytes = [System.IO.File]::ReadAllBytes($exe)
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
$matches = [regex]::Matches($text, '[a-zA-Z0-9_\-\.\:\\]{4,}') | ForEach-Object { $_.Value }
$keywords = $matches | Where-Object { $_ -match '(?i)USB|COM\d|LPT|TCP|BLE|GATT|Bluetooth|SPP|RFCOMM|inf|driver|port' } | Select-Object -Unique
Write-Output "=== Matching strings in driver installer ==="
$keywords | Select-Object -First 60
