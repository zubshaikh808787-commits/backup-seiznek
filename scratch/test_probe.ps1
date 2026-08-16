$csharp = @"
using System;
using System.Threading;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;

public class BleProbe {
    public static void Probe() {
        var watcher = new BluetoothLEAdvertisementWatcher();
        watcher.ScanningMode = BluetoothLEScanningMode.Active;
        watcher.Received += (s, e) => {
            string rawMac = e.BluetoothAddress.ToString("X12");
            string name = e.Advertisement.LocalName;
            if (!string.IsNullOrEmpty(name)) {
                Console.WriteLine("Found BLE: MAC=" + rawMac + " Name=" + name + " RSSI=" + e.RawSignalStrengthInDBm);
            }
        };
        watcher.Start();
        Console.WriteLine("Scanning BLE for 4 seconds...");
        Thread.Sleep(4000);
        watcher.Stop();
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

$cr = $cp.CompileAssemblyFromSource($param, $csharp)
if ($cr.Errors.Count -eq 0) {
    [BleProbe]::Probe()
} else {
    foreach ($err in $cr.Errors) {
        Write-Host "Compile Error: $err"
    }
}
