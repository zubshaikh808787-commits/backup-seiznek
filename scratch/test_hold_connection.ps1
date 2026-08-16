$csharp = @"
using System;
using System.Threading;
using Windows.Foundation;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;

public class BleSessionManager {
    private static GattSession _session = null;
    private static BluetoothLEDevice _device = null;

    public static T Await<T>(IAsyncOperation<T> op, int timeoutMs) {
        var evt = new ManualResetEvent(false);
        op.Completed = (info, status) => { evt.Set(); };
        if (!evt.WaitOne(timeoutMs)) return default(T);
        return op.GetResults();
    }

    public static string ConnectAndHold(string macHex) {
        try {
            ulong addr = Convert.ToUInt64(macHex.Replace(":", "").Replace("-", ""), 16);
            Console.WriteLine("Connecting to BLE Device 0x" + addr.ToString("X") + "...");
            _device = Await(BluetoothLEDevice.FromBluetoothAddressAsync(addr), 10000);
            if (_device == null) return "ERROR: Device not found";

            Console.WriteLine("Acquiring GattSession for " + _device.DeviceId + "...");
            var deviceIdObj = BluetoothDeviceId.FromId(_device.DeviceId);
            _session = Await(GattSession.FromDeviceIdAsync(deviceIdObj), 10000);
            if (_session == null) {
                return "ERROR: Could not create GattSession";
            }

            _session.MaintainConnection = true;
            Console.WriteLine("GattSession MaintainConnection set to TRUE. SessionStatus=" + _session.SessionStatus);
            Console.WriteLine("ConnectionStatus=" + _device.ConnectionStatus);

            return "SUCCESS: Connected and MaintainConnection active! Status: " + _device.ConnectionStatus;
        } catch (Exception ex) {
            return "EXCEPTION: " + ex.Message;
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

$cr = $cp.CompileAssemblyFromSource($param, $csharp)
if ($cr.Errors.Count -eq 0) {
    $res = [BleSessionManager]::ConnectAndHold("606E4101486A")
    Write-Host $res
} else {
    foreach ($err in $cr.Errors) {
        Write-Host "Compile Error: $err"
    }
}
