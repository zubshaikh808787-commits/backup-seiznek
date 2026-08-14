# Live Windows WinRT Bluetooth LE Advertisement Scanner Script via Register-ObjectEvent
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

[Windows.Devices.Bluetooth.Advertisement.BluetoothLEAdvertisementWatcher, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null
[Windows.Devices.Bluetooth.Advertisement.BluetoothLEScanningMode, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null

$watcher = New-Object Windows.Devices.Bluetooth.Advertisement.BluetoothLEAdvertisementWatcher
$watcher.ScanningMode = [Windows.Devices.Bluetooth.Advertisement.BluetoothLEScanningMode]::Active

$job = Register-ObjectEvent -InputObject $watcher -EventName "Received" -Action {
    $evt = $Event.SourceEventArgs
    $rawMac = $evt.BluetoothAddress.ToString("X12")
    $formattedMac = ($rawMac -replace '(..)(..)(..)(..)(..)(..)', '$1:$2:$3:$4:$5:$6')
    $name = $evt.Advertisement.LocalName
    if ([string]::IsNullOrWhiteSpace($name)) {
        $name = "BLE Peripheral ($formattedMac)"
    }
    $rssi = $evt.RawSignalStrengthInDBm
    Write-Output "$formattedMac|$name|$rssi"
}

$watcher.Start()
Start-Sleep -Seconds 3
$watcher.Stop()

$lines = Get-Job -Id $job.Id | Receive-Job
Unregister-Event -SourceIdentifier $job.Name -ErrorAction SilentlyContinue
Remove-Job -Id $job.Id -ErrorAction SilentlyContinue

$dict = @{}
if ($lines) {
    $items = @($lines)
    foreach ($line in $items) {
        if ($line -and $line.Contains('|')) {
            $parts = $line.Split('|')
            $mac = $parts[0]
            $name = $parts[1]
            $rssi = [int]$parts[2]
            
            $dict[$mac] = @{
                id = $mac
                address = $mac
                name = $name
                rssi = $rssi
            }
        }
    }
}

$results = @($dict.Values)
$results | ConvertTo-Json -Compress
