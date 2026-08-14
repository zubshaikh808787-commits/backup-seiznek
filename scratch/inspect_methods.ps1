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

$addr = [Convert]::ToUInt64("606E4101486A", 16)
$asyncDev = [Windows.Devices.Bluetooth.BluetoothLEDevice]::FromBluetoothAddressAsync($addr)
$device = Await-Operation $asyncDev ([Windows.Devices.Bluetooth.BluetoothLEDevice])

$asyncServices = $device.GetGattServicesAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)
$servicesRes = Await-Operation $asyncServices ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult])

$s = $servicesRes.Services[0]
$asyncChars = $s.GetCharacteristicsAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)
$charsRes = Await-Operation $asyncChars ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult])
$c = $charsRes.Characteristics[0]

$c | Get-Member -Name "Write*" | Format-List
