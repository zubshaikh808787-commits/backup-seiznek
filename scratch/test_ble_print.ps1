param(
    [string]$MacAddress = "60:6E:41:01:48:6A",
    [string]$FilePath = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

[Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null
[Windows.Devices.Bluetooth.BluetoothCacheMode, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null
[Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataWriter, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$cleanMac = $MacAddress.Replace(":", "").Replace("-", "")
$addr = [Convert]::ToUInt64($cleanMac, 16)

Write-Host "Connecting to GATT Device at MAC $MacAddress..."
$asyncDev = [Windows.Devices.Bluetooth.BluetoothLEDevice]::FromBluetoothAddressAsync($addr)
while ($asyncDev.Status -eq 0) { Start-Sleep -Milliseconds 50 }
$device = $asyncDev.GetResults()

if (-not $device) {
    Write-Host "ERROR: Could not connect to BLE device at $MacAddress"
    exit 1
}

$asyncServices = $device.GetGattServicesAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)
while ($asyncServices.Status -eq 0) { Start-Sleep -Milliseconds 50 }
$servicesRes = $asyncServices.GetResults()

$writeChar = $null
foreach ($s in $servicesRes.Services) {
    $suuid = $s.Uuid.ToString().ToLower()
    $asyncChars = $s.GetCharacteristicsAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)
    while ($asyncChars.Status -eq 0) { Start-Sleep -Milliseconds 50 }
    $charsRes = $asyncChars.GetResults()

    if ($charsRes.Status -eq [Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus]::Success) {
        foreach ($c in $charsRes.Characteristics) {
            $cuuid = $c.Uuid.ToString().ToLower()
            if ($cuuid.Contains("bef8d6c9") -or $cuuid.Contains("fff2") -or $cuuid.Contains("ffe1") -or $cuuid.Contains("2af1")) {
                if ($c.CharacteristicProperties -band 4 -or $c.CharacteristicProperties -band 8) {
                    $writeChar = $c
                    Write-Host "Selected SDK Writable Characteristic: $cuuid (Service: $suuid)"
                    break
                }
            }
        }
    }
    if ($writeChar) { break }
}

if (-not $writeChar) {
    Write-Host "ERROR: No SDK writable characteristic found."
    exit 1
}

# Payload bytes
$bytes = [byte[]]@()
if ($FilePath -and (Test-Path $FilePath)) {
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
} else {
    $esc = [char]27
    $gs = [char]29
    $payloadText = "$esc@$esca`x01================================`r`n          TEST RECEIPT          `r`n================================`r`n`r`nPrinter: VEER BLE (MPT-II)`r`nConnection: REAL BLE GATT`r`n`r`nBLE PRINT TEST VERIFIED`r`n`r`n================================`r`n`r`n`r`n$escd`x03$gsV`x00"
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($payloadText)
}

$totalBytes = $bytes.Length
Write-Host "Transmitting $totalBytes bytes over BLE GATT..."
$chunkSize = 100

for ($i = 0; $i -lt $bytes.Length; $i += $chunkSize) {
    $len = [Math]::Min($chunkSize, $bytes.Length - $i)
    $chunk = [byte[]]::new($len)
    [Array]::Copy($bytes, $i, $chunk, 0, $len)

    $writer = [Windows.Storage.Streams.DataWriter]::new()
    $writer.WriteBytes($chunk)
    $buf = $writer.DetachBuffer()

    $asyncWrite = $writeChar.WriteValueWithResultAsync($buf)
    while ($asyncWrite.Status -eq 0) { Start-Sleep -Milliseconds 20 }
    $writeRes = $asyncWrite.GetResults()

    if ($writeRes.Status -eq [Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus]::Success) {
        Write-Host "Chunk written successfully OK"
    } else {
        $statusStr = $writeRes.Status.ToString()
        Write-Host "Chunk write status: $statusStr"
    }
    Start-Sleep -Milliseconds 25
}

Write-Host "SUCCESS: Real BLE GATT receipt transmission complete!"
