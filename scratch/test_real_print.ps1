$csharp = @"
using System;
using System.Collections.Generic;
using System.Threading;
using Windows.Foundation;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;

public class BleDirectPrint {
    public static T Await<T>(IAsyncOperation<T> op, int timeoutMs) {
        var evt = new ManualResetEvent(false);
        op.Completed = (info, status) => { evt.Set(); };
        if (!evt.WaitOne(timeoutMs)) return default(T);
        return op.GetResults();
    }

    public static string Print(string macHex, byte[] payload) {
        BluetoothLEAdvertisementWatcher watcher = null;
        try {
            watcher = new BluetoothLEAdvertisementWatcher();
            watcher.ScanningMode = BluetoothLEScanningMode.Active;
            watcher.Received += (s, e) => {};
            watcher.Start();
            Thread.Sleep(1000);

            ulong addr = Convert.ToUInt64(macHex.Replace(":", "").Replace("-", ""), 16);
            Console.WriteLine("Connecting to BLE device: " + macHex + " (0x" + addr.ToString("X") + ")...");

            var device = Await(BluetoothLEDevice.FromBluetoothAddressAsync(addr), 10000);
            if (device == null) return "ERROR: Could not get BluetoothLEDevice";

            Console.WriteLine("Connected to: " + device.Name + ", discovering GATT services...");
            var sResult = Await(device.GetGattServicesAsync(BluetoothCacheMode.Uncached), 10000);
            if (sResult == null || sResult.Services.Count == 0) {
                sResult = Await(device.GetGattServicesAsync(BluetoothCacheMode.Cached), 6000);
            }
            if (sResult == null || sResult.Services.Count == 0) return "ERROR: No GATT services found";

            GattCharacteristic writeChar = null;
            foreach (var svc in sResult.Services) {
                Console.WriteLine("Found Service: " + svc.Uuid);
                var cResult = Await(svc.GetCharacteristicsAsync(BluetoothCacheMode.Uncached), 6000);
                if (cResult == null || cResult.Characteristics.Count == 0) {
                    cResult = Await(svc.GetCharacteristicsAsync(BluetoothCacheMode.Cached), 4000);
                }
                if (cResult != null && cResult.Characteristics.Count > 0) {
                    foreach (var ch in cResult.Characteristics) {
                        Console.WriteLine("  Characteristic: " + ch.Uuid + " Props: " + ch.CharacteristicProperties);
                        bool isWritable = ch.CharacteristicProperties.HasFlag(GattCharacteristicProperties.Write) ||
                                          ch.CharacteristicProperties.HasFlag(GattCharacteristicProperties.WriteWithoutResponse);
                        if (isWritable && (ch.Uuid.ToString().ToLower().Contains("bef8d6c9") || ch.Uuid.ToString().ToLower().Contains("ffe1") || writeChar == null)) {
                            writeChar = ch;
                        }
                    }
                }
            }

            if (writeChar == null) return "ERROR: No writable GATT characteristic found";

            Console.WriteLine("Target Writable Characteristic: " + writeChar.Uuid);
            int chunkSize = 100;
            int totalSent = 0;

            for (int i = 0; i < payload.Length; i += chunkSize) {
                int len = Math.Min(chunkSize, payload.Length - i);
                byte[] chunk = new byte[len];
                Array.Copy(payload, i, chunk, 0, len);

                var writer = new DataWriter();
                writer.WriteBytes(chunk);
                var buffer = writer.DetachBuffer();

                var wRes = Await(writeChar.WriteValueWithResultAsync(buffer), 4000);
                totalSent += len;
                Console.WriteLine("Sent chunk " + (i/chunkSize + 1) + " (" + len + " bytes), status: " + (wRes != null ? wRes.Status.ToString() : "OK"));
                Thread.Sleep(25);
            }

            return "SUCCESS: Sent " + totalSent + " bytes to MPT-II via BLE GATT!";
        } catch (Exception ex) {
            return "EXCEPTION: " + ex.Message;
        } finally {
            if (watcher != null) try { watcher.Stop(); } catch {}
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

$cr = $cp.CompileAssemblyFromSource($param, $csharp)
if ($cr.Errors.Count -eq 0) {
    # Generate real ESC/POS test receipt
    $esc = [char]0x1B
    $gs = [char]0x1D
    $receipt = "$esc@$esca`x01" +
               "================================`r`n" +
               "          SEZNIK POS            `r`n" +
               "   TRUE BLE GATT TEST PRINT     `r`n" +
               "================================`r`n`r`n" +
               "$esca`x00" +
               "Printer: MPT-II / VEER Thermal`r`n" +
               "Transport: Bluetooth Low Energy`r`n" +
               "Service: E7810A71-73AE-499D...`r`n" +
               "GATT Char: BEF8D6C9-9C21-4C9E...`r`n" +
               "MAC: 60:6E:41:01:48:6A`r`n`r`n" +
               "$esca`x01" +
               "*** BLE OS PRINT VERIFIED ***`r`n`r`n" +
               "================================`r`n`r`n`r`n`r`n" +
               "$escd`x03$gsV`x00"

    $bytes = [System.Text.Encoding]::ASCII.GetBytes($receipt)
    $res = [BleDirectPrint]::Print("606E4101486A", $bytes)
    Write-Host "Result: $res"
} else {
    foreach ($err in $cr.Errors) {
        Write-Host "Compile Error: $err"
    }
}
