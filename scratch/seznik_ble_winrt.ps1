param(
    [string]$Action = "scan",
    [string]$MacAddress = "60:6E:41:01:48:6A",
    [string]$FilePath = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$csharpCode = @"
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using Windows.Foundation;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;

namespace SeznikBle {
    public class WinRtTransport {
        public static T AwaitWinRt<T>(IAsyncOperation<T> op, int timeoutMs) {
            var resetEvent = new ManualResetEvent(false);
            op.Completed = (info, status) => { resetEvent.Set(); };
            bool ok = resetEvent.WaitOne(timeoutMs);
            if (!ok) return default(T);
            return op.GetResults();
        }

        public static string ScanJson(int timeoutSeconds) {
            var watcher = new BluetoothLEAdvertisementWatcher();
            watcher.ScanningMode = BluetoothLEScanningMode.Active;
            var list = new List<string>();
            var locker = new object();

            TypedEventHandler<BluetoothLEAdvertisementWatcher, BluetoothLEAdvertisementReceivedEventArgs> handler = 
                (sender, args) => {
                    lock(locker) {
                        string rawMac = args.BluetoothAddress.ToString("X12");
                        string mac = string.Format("{0}:{1}:{2}:{3}:{4}:{5}",
                            rawMac.Substring(0, 2), rawMac.Substring(2, 2),
                            rawMac.Substring(4, 2), rawMac.Substring(6, 2),
                            rawMac.Substring(8, 2), rawMac.Substring(10, 2));
                        string name = args.Advertisement.LocalName;
                        if (!string.IsNullOrEmpty(name)) {
                            list.Add(mac + "|" + name + "|" + args.RawSignalStrengthInDBm);
                        }
                    }
                };

            watcher.Received += handler;
            watcher.Start();
            Thread.Sleep(timeoutSeconds * 1000);
            watcher.Stop();
            watcher.Received -= handler;
            return string.Join(";", list.Distinct());
        }

        public static string ConnectAndWrite(string macAddressHex, byte[] payloadBytes) {
            BluetoothLEAdvertisementWatcher watcher = null;
            TypedEventHandler<BluetoothLEAdvertisementWatcher, BluetoothLEAdvertisementReceivedEventArgs> handler = (s, e) => {};

            try {
                // Activate BLE Watcher to trigger Windows OS BLE Session creation
                watcher = new BluetoothLEAdvertisementWatcher();
                watcher.ScanningMode = BluetoothLEScanningMode.Active;
                watcher.Received += handler;
                watcher.Start();
                Thread.Sleep(1500);

                ulong address = Convert.ToUInt64(macAddressHex.Replace(":", "").Replace("-", ""), 16);
                var device = AwaitWinRt(BluetoothLEDevice.FromBluetoothAddressAsync(address), 8000);

                if (device == null) {
                    watcher.Stop();
                    watcher.Received -= handler;
                    return "ERROR|Could not connect to BLE device at " + macAddressHex;
                }

                // Get GATT Services
                var servicesResult = AwaitWinRt(device.GetGattServicesAsync(BluetoothCacheMode.Uncached), 8000);
                if (servicesResult == null || servicesResult.Status != GattCommunicationStatus.Success || servicesResult.Services.Count == 0) {
                    servicesResult = AwaitWinRt(device.GetGattServicesAsync(BluetoothCacheMode.Cached), 6000);
                }

                watcher.Stop();
                watcher.Received -= handler;

                if (servicesResult == null || servicesResult.Services.Count == 0) {
                    return "ERROR|Gatt Service discovery failed.";
                }

                GattCharacteristic writeChar = null;
                string foundServiceUuid = "";
                string foundCharUuid = "";

                foreach (var service in servicesResult.Services) {
                    var charsResult = AwaitWinRt(service.GetCharacteristicsAsync(BluetoothCacheMode.Uncached), 4000);
                    if (charsResult == null || charsResult.Characteristics.Count == 0) {
                        charsResult = AwaitWinRt(service.GetCharacteristicsAsync(BluetoothCacheMode.Cached), 4000);
                    }

                    if (charsResult != null && charsResult.Status == GattCommunicationStatus.Success) {
                        foreach (var c in charsResult.Characteristics) {
                            string cuuid = c.Uuid.ToString().ToLower();
                            if (cuuid.Contains("bef8d6c9") || cuuid.Contains("fff2") || cuuid.Contains("ffe1") || cuuid.Contains("2af1")) {
                                if (c.CharacteristicProperties.HasFlag(GattCharacteristicProperties.Write) ||
                                    c.CharacteristicProperties.HasFlag(GattCharacteristicProperties.WriteWithoutResponse)) {
                                    writeChar = c;
                                    foundServiceUuid = service.Uuid.ToString();
                                    foundCharUuid = c.Uuid.ToString();
                                    break;
                                }
                            }
                        }
                    }
                    if (writeChar != null) break;
                }

                if (writeChar == null) {
                    foreach (var service in servicesResult.Services) {
                        var charsResult = AwaitWinRt(service.GetCharacteristicsAsync(BluetoothCacheMode.Cached), 3000);
                        if (charsResult != null && charsResult.Status == GattCommunicationStatus.Success) {
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
                }

                if (writeChar == null) {
                    return "ERROR|No writable GATT characteristic discovered on BLE device.";
                }

                // Chunk writing over BLE GATT
                int chunkSize = 100;
                int totalSent = 0;

                for (int i = 0; i < payloadBytes.Length; i += chunkSize) {
                    int len = Math.Min(chunkSize, payloadBytes.Length - i);
                    byte[] chunk = new byte[len];
                    Array.Copy(payloadBytes, i, chunk, 0, len);

                    var writer = new Windows.Storage.Streams.DataWriter();
                    writer.WriteBytes(chunk);
                    var buffer = writer.DetachBuffer();

                    var writeResult = AwaitWinRt(writeChar.WriteValueWithResultAsync(buffer), 4000);

                    if (writeResult == null || writeResult.Status != GattCommunicationStatus.Success) {
                        return "ERROR|Chunk write failed at offset " + i;
                    }
                    totalSent += len;
                    Thread.Sleep(20);
                }

                return "SUCCESS|Service:" + foundServiceUuid + "|Char:" + foundCharUuid + "|Bytes:" + totalSent;
            } catch (Exception ex) {
                if (watcher != null) try { watcher.Stop(); watcher.Received -= handler; } catch (Exception) {}
                return "EXCEPTION|" + ex.Message;
            }
        }
    }
}
"@

$cp = New-Object Microsoft.CSharp.CSharpCodeProvider
$param = New-Object System.CodeDom.Compiler.CompilerParameters
$param.GenerateInMemory = $true

$netDir = [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()

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
if ($cr.Errors.Count -ne 0) {
    foreach ($err in $cr.Errors) {
        Write-Host "Compile Error: "$err.ErrorText
    }
    exit 1
}

if ($Action -eq "scan") {
    [SeznikBle.WinRtTransport]::ScanJson(4)
} elseif ($Action -eq "write") {
    $bytes = [byte[]]@()
    if ($FilePath -and (Test-Path $FilePath)) {
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    } else {
        $payloadText = "================================`r`n          TEST RECEIPT          `r`n================================`r`n`r`nPrinter: VEER BLE (MPT-II)`r`nConnection: REAL BLE GATT`r`n`r`nBLE PRINT TEST VERIFIED`r`n`r`n================================`r`n`r`n`r`n"
        $bytes = [System.Text.Encoding]::ASCII.GetBytes($payloadText)
    }
    [SeznikBle.WinRtTransport]::ConnectAndWrite($MacAddress, $bytes)
}
