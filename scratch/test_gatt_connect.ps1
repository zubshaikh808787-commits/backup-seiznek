# Live WinRT BLE GATT Connect and Write Test Script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$csharpCode = @"
using System;
using System.Threading.Tasks;
using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;

namespace SeznikBle {
    public class BleGattConnector {
        public static string ConnectAndWrite(string macAddressHex, byte[] payloadBytes) {
            try {
                ulong address = Convert.ToUInt64(macAddressHex.Replace(":", "").Replace("-", ""), 16);
                var deviceTask = BluetoothLEDevice.FromBluetoothAddressAsync(address).AsTask();
                deviceTask.Wait(8000);
                var device = deviceTask.Result;

                if (device == null) {
                    return "ERROR: Could not connect to BLE device with address " + macAddressHex;
                }

                var servicesTask = device.GetGattServicesAsync(BluetoothCacheMode.Uncached).AsTask();
                servicesTask.Wait(8000);
                var servicesResult = servicesTask.Result;

                if (servicesResult.Status != GattCommunicationStatus.Success || servicesResult.Services.Count == 0) {
                    return "ERROR: Service discovery failed. Status: " + servicesResult.Status;
                }

                GattCharacteristic writeChar = null;
                string foundServiceUuid = "";
                string foundCharUuid = "";

                foreach (var service in servicesResult.Services) {
                    var charsTask = service.GetCharacteristicsAsync(BluetoothCacheMode.Uncached).AsTask();
                    charsTask.Wait(5000);
                    var charsResult = charsTask.Result;

                    if (charsResult.Status == GattCommunicationStatus.Success) {
                        foreach (var c in charsResult.Characteristics) {
                            if (c.CharacteristicProperties.HasFlag(GattCharacteristicProperties.Write) ||
                                c.CharacteristicProperties.HasFlag(GattCharacteristicProperties.WriteWithoutResponse)) {
                                writeChar = c;
                                foundServiceUuid = service.Uuid.ToString();
                                foundCharUuid = c.Uuid.ToString();
                                break;
                            }
                        }
                    }
                    if (writeChar != null) break;
                }

                if (writeChar == null) {
                    return "ERROR: No writable GATT characteristic discovered on BLE device.";
                }

                // Chunk writing over BLE GATT
                int chunkSize = 100;
                int totalSent = 0;

                for (int i = 0; i < payloadBytes.Length; i += chunkSize) {
                    int len = Math.Min(chunkSize, payloadBytes.Length - i);
                    byte[] chunk = new byte[len];
                    Array.Copy(payloadBytes, i, chunk, 0, len);

                    var buffer = WindowsRuntimeBufferExtensions.AsBuffer(chunk, 0, len);

                    var writeOption = writeChar.CharacteristicProperties.HasFlag(GattCharacteristicProperties.WriteWithoutResponse)
                        ? GattWriteOption.WriteWithoutResponse
                        : GattWriteOption.WriteWithResponse;

                    var writeTask = writeChar.WriteValueWithResultAsync(buffer, writeOption).AsTask();
                    writeTask.Wait(4000);
                    var writeResult = writeTask.Result;

                    if (writeResult.Status != GattCommunicationStatus.Success) {
                        return "ERROR: Chunk write failed at offset " + i + ". Status: " + writeResult.Status;
                    }
                    totalSent += len;
                    System.Threading.Thread.Sleep(25);
                }

                return "SUCCESS|Service:" + foundServiceUuid + "|Char:" + foundCharUuid + "|Bytes:" + totalSent;
            } catch (Exception ex) {
                return "EXCEPTION: " + ex.Message + " | " + ex.StackTrace;
            }
        }
    }
}
"@

$netDir = [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
$cp = New-Object Microsoft.CSharp.CSharpCodeProvider
$param = New-Object System.CodeDom.Compiler.CompilerParameters
$param.GenerateInMemory = $true

$param.ReferencedAssemblies.Add("System.dll") | Out-Null
$param.ReferencedAssemblies.Add("System.Core.dll") | Out-Null
$param.ReferencedAssemblies.Add("$netDir\System.Runtime.dll") | Out-Null
$param.ReferencedAssemblies.Add("$netDir\System.ObjectModel.dll") | Out-Null
$param.ReferencedAssemblies.Add("$netDir\System.Runtime.WindowsRuntime.dll") | Out-Null
$param.ReferencedAssemblies.Add("$netDir\System.Runtime.InteropServices.WindowsRuntime.dll") | Out-Null
$param.ReferencedAssemblies.Add("C:\Windows\System32\WinMetadata\Windows.Foundation.winmd") | Out-Null
$param.ReferencedAssemblies.Add("C:\Windows\System32\WinMetadata\Windows.Devices.winmd") | Out-Null
$param.ReferencedAssemblies.Add("C:\Windows\System32\WinMetadata\Windows.Storage.winmd") | Out-Null

$cr = $cp.CompileAssemblyFromSource($param, $csharpCode)
if ($cr.Errors.Count -eq 0) {
    # Test payload ESC/POS test receipt bytes
    $testPayload = [System.Text.Encoding]::ASCII.GetBytes("`e@`ea`a1================================`r`n          TEST RECEIPT          `r`n================================`r`n`r`nPrinter: VEER BLE (MPT-II)`r`nConnection: REAL BLE GATT`r`n`r`nBLE PRINT TEST VERIFIED`r`n`r`n================================`r`n`r`n`r`n`ed`a3`eV`a0")
    [SeznikBle.BleGattConnector]::ConnectAndWrite("60:6E:41:01:48:6A", $testPayload)
} else {
    foreach ($err in $cr.Errors) {
        Write-Host "Compile Error: "$err.ErrorText
    }
}
