param(
    [string]$MacAddress = "60:6E:41:01:48:6A"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

[System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime") | Out-Null
[Windows.Devices.Bluetooth.BluetoothLEDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null
[Windows.Devices.Bluetooth.BluetoothCacheMode, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null
[Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Length -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
}[0]

function Await-Operation($asyncOp, $targetType) {
    $m = $asTaskGeneric.MakeGenericMethod($targetType)
    $task = $m.Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

$cleanMac = $MacAddress.Replace(":", "").Replace("-", "")
$addr = [Convert]::ToUInt64($cleanMac, 16)

Write-Host "Connecting to BLE address $MacAddress..."
$asyncDev = [Windows.Devices.Bluetooth.BluetoothLEDevice]::FromBluetoothAddressAsync($addr)
$device = Await-Operation $asyncDev ([Windows.Devices.Bluetooth.BluetoothLEDevice])

if (-not $device) {
    Write-Host "ERROR: Could not connect to BLE device at $MacAddress"
    exit 1
}

Write-Host "Connected to GATT Device: $($device.Name) [Status: $($device.ConnectionStatus)]"

$asyncServices = $device.GetGattServicesAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)
$servicesRes = Await-Operation $asyncServices ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult])

if ($servicesRes.Status -ne [Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus]::Success) {
    Write-Host "ERROR: Service discovery failed. Status: $($servicesRes.Status)"
    exit 1
}

Write-Host "Discovered $($servicesRes.Services.Count) GATT Service(s):"
$targetChar = $null

foreach ($s in $servicesRes.Services) {
    Write-Host " - Service UUID: $($s.Uuid)"
    $asyncChars = $s.GetCharacteristicsAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)
    $charsRes = Await-Operation $asyncChars ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult])

    if ($charsRes.Status -eq [Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus]::Success) {
        foreach ($c in $charsRes.Characteristics) {
            Write-Host "   * Characteristic UUID: $($c.Uuid) [Properties: $($c.CharacteristicProperties)]"
            if ($c.CharacteristicProperties -band 4 -or $c.CharacteristicProperties -band 8) {
                $targetChar = $c
            }
        }
    }
}

if ($targetChar) {
    Write-Host "SUCCESS: Discovered Writable Characteristic UUID: $($targetChar.Uuid)"
} else {
    Write-Host "ERROR: No writable GATT characteristic found."
}
