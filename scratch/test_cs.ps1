# Live WinRT BLE Scanner via CSharpCodeProvider
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$code = @"
using System;
using System.Collections.Generic;
using System.Linq;
using Windows.Foundation;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;

public class WinRtBle {
    public static string Scan() {
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
        System.Threading.Thread.Sleep(3500);
        watcher.Stop();
        watcher.Received -= handler;
        return string.Join(";", list.Distinct());
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

$cr = $cp.CompileAssemblyFromSource($param, $code)
if ($cr.Errors.Count -eq 0) {
    [WinRtBle]::Scan()
} else {
    foreach ($err in $cr.Errors) {
        Write-Host "Compile Error: "$err.ErrorText
    }
}
