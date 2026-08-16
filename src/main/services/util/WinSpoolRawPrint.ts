import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../../logger';

const execPromise = util.promisify(exec);

// Sends raw bytes to an installed Windows printer QUEUE (by name) via the
// winspool.drv RAW datatype — the same technique already used for USB
// printing (see WindowsUsbTransport / TestPrintService).
const RAW_PRINT_SCRIPT_CONTENT = `param(
    [string]$PrinterName,
    [string]$FilePath
)

$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendFileToPrinter(string szPrinterName, string szFileName) {
        if (!File.Exists(szFileName)) return false;
        byte[] bytes = File.ReadAllBytes(szFileName);

        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "SEZNIK RAW Print Job";
        di.pDataType = "RAW";

        if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) return false;
        if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
        if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }

        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

        int dwWritten = 0;
        bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);

        return success;
    }
}
"@

try {
    if (-not ("RawPrinterHelper" -as [type])) {
        Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
    }
} catch {}

$res = [RawPrinterHelper]::SendFileToPrinter($PrinterName, $FilePath)
if (-not $res) {
    Write-Warning "winspool.drv OpenPrinter/WritePrinter returned false for $PrinterName."
    exit 1
}
`;

// Direct Win32 / .NET Serial Port streaming for Bluetooth SPP / RFCOMM ports (e.g. COM4).
// Bypasses Windows Spooler timeouts to stream ESC/POS bytes directly.
const DIRECT_SERIAL_SCRIPT_CONTENT = `param(
    [string]$PortName,
    [string]$FilePath
)

if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

$cleanPort = $PortName.Replace(":", "").Trim()
[byte[]]$bytes = [System.IO.File]::ReadAllBytes($FilePath)

# Channel 1: .NET SerialPort with DTR/RTS enabled & explicit flush
try {
    $port = New-Object System.IO.Ports.SerialPort $cleanPort, 9600, "None", 8, "One"
    $port.ReadTimeout = 4000
    $port.WriteTimeout = 4000
    $port.DtrEnable = $true
    $port.RtsEnable = $true
    $port.Open()
    $port.Write($bytes, 0, $bytes.Length)
    Start-Sleep -Milliseconds 250
    $port.Close()
    $port.Dispose()
    Write-Host "[DirectSerial] SUCCESS: Delivered $($bytes.Length) bytes to $cleanPort via SerialPort!"
    exit 0
} catch {
    Write-Warning "[DirectSerial] SerialPort notice: $($_.Exception.Message)"
}

# Channel 2: Win32 CreateFile / WriteFile Fallback
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class DirectSerialPrinterHelper {
    [StructLayout(LayoutKind.Sequential)]
    public struct COMMTIMEOUTS {
        public uint ReadIntervalTimeout;
        public uint ReadTotalTimeoutMultiplier;
        public uint ReadTotalTimeoutConstant;
        public uint WriteTotalTimeoutMultiplier;
        public uint WriteTotalTimeoutConstant;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern SafeFileHandle CreateFile(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetCommTimeouts(SafeFileHandle hFile, ref COMMTIMEOUTS lpCommTimeouts);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool WriteFile(
        SafeFileHandle hFile,
        byte[] lpBuffer,
        uint nNumberOfBytesToWrite,
        out uint lpNumberOfBytesWritten,
        IntPtr lpOverlapped);

    public static bool SendFileToPort(string portName, string filePath) {
        if (!File.Exists(filePath)) return false;
        byte[] bytes = File.ReadAllBytes(filePath);

        string clean = portName.Replace(":", "").Trim();
        string devicePath = @"\\\\.\\" + clean;

        SafeFileHandle handle = CreateFile(devicePath, 0xC0000000, 0, IntPtr.Zero, 3, 0, IntPtr.Zero);
        if (handle.IsInvalid) {
            return false;
        }

        COMMTIMEOUTS timeouts = new COMMTIMEOUTS();
        timeouts.ReadIntervalTimeout = 50;
        timeouts.ReadTotalTimeoutMultiplier = 10;
        timeouts.ReadTotalTimeoutConstant = 1000;
        timeouts.WriteTotalTimeoutMultiplier = 10;
        timeouts.WriteTotalTimeoutConstant = 4000;
        SetCommTimeouts(handle, ref timeouts);

        uint written = 0;
        bool result = WriteFile(handle, bytes, (uint)bytes.Length, out written, IntPtr.Zero);
        handle.Close();

        return result && (written > 0 || bytes.Length == 0);
    }
}
"@

try {
    if (-not ("DirectSerialPrinterHelper" -as [type])) {
        Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
    }
} catch {}

$res = [DirectSerialPrinterHelper]::SendFileToPort($cleanPort, $FilePath)
if (-not $res) {
    Write-Warning "Direct serial write returned false for $cleanPort."
    exit 1
}
`;

export async function sendRawBytesToPrinterQueue(
  queueName: string,
  data: Buffer,
  jobLabel = 'SEZNIK RAW Print Job'
): Promise<{ success: boolean; message: string }> {
  if (os.platform() !== 'win32') {
    return { success: false, message: 'RAW printer queue writes are only supported on Windows.' };
  }

  const scriptPath = path.join(os.tmpdir(), 'seznik_winspool_raw_shared.ps1');
  const tempFile = path.join(os.tmpdir(), `seznik_raw_payload_${Date.now()}.bin`);

  try {
    fs.writeFileSync(scriptPath, RAW_PRINT_SCRIPT_CONTENT, 'utf-8');
    fs.writeFileSync(tempFile, data);

    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${queueName}" -FilePath "${tempFile}"`;
    await execPromise(psCmd, { timeout: 15000 });

    logger.info(`[WinSpoolRawPrint] Delivered ${data.length} bytes to "${queueName}" via WinSpool RAW ✓`);
    return { success: true, message: `${jobLabel} (${data.length} bytes) delivered to "${queueName}" via the Windows print queue.` };
  } catch (err: any) {
    let detail: string = err.stderr || err.message || 'Unknown WinSpool error';
    if (detail.includes('OpenPrinter/WritePrinter returned false')) {
      detail = `Printer queue "${queueName}" returned offline or error. Ensure printer is connected and powered on.`;
    } else if (detail.includes('Command failed')) {
      detail = `Could not communicate with printer queue "${queueName}". Verify printer connection.`;
    }
    logger.error(`[WinSpoolRawPrint ERROR] Failed writing to "${queueName}": ${detail}`);
    return { success: false, message: detail };
  } finally {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
  }
}

// Direct WinRT StreamSocket RFCOMM streaming for Bluetooth thermal printers (e.g. MPT-II).
// Connects directly via WinRT Bluetooth socket to bypass spooler lock & timeouts.
const WINRT_BT_SCRIPT_CONTENT = `param(
    [string]$MacAddress = "606E4101486A",
    [string]$FilePath
)

$macClean = $MacAddress.Replace(":", "").Replace("-", "").Trim()
if ([string]::IsNullOrWhiteSpace($macClean)) {
    $macClean = "606E4101486A"
}

if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

[byte[]]$rawBytes = [System.IO.File]::ReadAllBytes($FilePath)

[System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime") | Out-Null

[Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null
[Windows.Devices.Bluetooth.Rfcomm.RfcommDeviceService, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null
[Windows.Networking.Sockets.StreamSocket, Windows.Networking.Sockets, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataWriter, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$allTypes = foreach ($asm in [AppDomain]::CurrentDomain.GetAssemblies()) { try { $asm.GetTypes() } catch {} }
$ioStreamType = $allTypes | Where-Object { $_.FullName -eq 'Windows.Storage.Streams.IOutputStream' } | Select-Object -First 1
$writeMethod = $ioStreamType.GetMethod("WriteAsync")
$flushMethod = $ioStreamType.GetMethod("FlushAsync")

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' }
$asTaskAction = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' }
$connectMethod = [Windows.Networking.Sockets.StreamSocket].GetMethod("ConnectAsync", [type[]]@([Windows.Networking.HostName], [string]))

$macInt = [UInt64]::Parse($macClean, [System.Globalization.NumberStyles]::HexNumber)

$asyncDev = [Windows.Devices.Bluetooth.BluetoothDevice]::FromBluetoothAddressAsync($macInt)
$taskDev = $asTaskGeneric.MakeGenericMethod([Windows.Devices.Bluetooth.BluetoothDevice]).Invoke($null, @($asyncDev))
$taskDev.Wait(6000)
$device = $taskDev.Result

if (-not $device) {
    Write-Error "[WinRtBtPrint] Bluetooth device $macClean not found."
    exit 2
}

$asyncServices = $device.GetRfcommServicesAsync()
$taskServices = $asTaskGeneric.MakeGenericMethod([Windows.Devices.Bluetooth.Rfcomm.RfcommDeviceServicesResult]).Invoke($null, @($asyncServices))
$taskServices.Wait(6000)
$servicesResult = $taskServices.Result

if (-not $servicesResult.Services -or $servicesResult.Services.Count -eq 0) {
    Write-Error "[WinRtBtPrint] No RFCOMM services found on device $($device.Name)."
    exit 3
}

$service = $servicesResult.Services | Where-Object { $_.ServiceId.AsString().ToLower().Contains("1101") } | Select-Object -First 1
if (-not $service) { $service = $servicesResult.Services[0] }

$hostName = $service.ConnectionHostName
$svcNameStr = "" + $service.ConnectionServiceName

$socket = New-Object Windows.Networking.Sockets.StreamSocket
$asyncConnect = $connectMethod.Invoke($socket, @($hostName, $svcNameStr))
$taskConnect = $asTaskAction.Invoke($null, @($asyncConnect))
if (-not $taskConnect.Wait(10000)) {
    Write-Error "[WinRtBtPrint] Connection timeout to $($hostName.CanonicalName)."
    $socket.Dispose()
    exit 4
}

$writer = New-Object Windows.Storage.Streams.DataWriter
$writer.WriteBytes($rawBytes)
$buffer = $writer.DetachBuffer()

$outStream = $socket.OutputStream
$writeMethod.Invoke($outStream, @($buffer)) | Out-Null
Start-Sleep -Milliseconds 400

$flushMethod.Invoke($outStream, @()) | Out-Null
Start-Sleep -Milliseconds 400

$writer.Dispose()
$socket.Dispose()
Write-Host "[WinRtBtPrint] SUCCESS: Delivered $($rawBytes.Length) raw ESC/POS bytes over Bluetooth RFCOMM to $($device.Name)!"
exit 0
`;

export async function sendRawBytesToWinRtBluetooth(
  macAddressHex = '606E4101486A',
  data: Buffer,
  jobLabel = 'SEZNIK Bluetooth RFCOMM Print Job'
): Promise<{ success: boolean; message: string }> {
  if (os.platform() !== 'win32') {
    return { success: false, message: 'WinRT Bluetooth is only supported on Windows.' };
  }

  const scriptPath = path.join(os.tmpdir(), 'seznik_winrt_bt_shared.ps1');
  const tempFile = path.join(os.tmpdir(), `seznik_bt_payload_${Date.now()}.bin`);

  try {
    fs.writeFileSync(scriptPath, WINRT_BT_SCRIPT_CONTENT, 'utf-8');
    fs.writeFileSync(tempFile, data);

    const cleanMac = macAddressHex.replace(/[:\-]/g, '').trim() || '606E4101486A';
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -MacAddress "${cleanMac}" -FilePath "${tempFile}"`;
    await execPromise(psCmd, { timeout: 18000 });

    logger.info(`[WinRtBtPrint] Delivered ${data.length} bytes to Bluetooth device MAC ${cleanMac} via WinRT RFCOMM ✓`);
    return { success: true, message: `${jobLabel} (${data.length} bytes) delivered to Bluetooth printer (MAC: ${cleanMac}) successfully ✓` };
  } catch (err: any) {
    const detail: string = err.stderr || err.message || 'Unknown WinRT Bluetooth error';
    logger.error(`[WinRtBtPrint ERROR] Failed writing to Bluetooth device (${macAddressHex}): ${detail}`);
    return { success: false, message: detail };
  } finally {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
  }
}

export async function sendRawBytesToSerialPort(
  portNameOrMac: string,
  data: Buffer,
  jobLabel = 'SEZNIK Direct Serial Print Job'
): Promise<{ success: boolean; message: string }> {
  if (os.platform() !== 'win32') {
    return { success: false, message: 'Serial port writes are only supported on Windows.' };
  }

  // If portNameOrMac is a Bluetooth device or MAC, route to WinRT RFCOMM socket!
  const cleanMac = portNameOrMac.replace(/[:\-]/g, '').trim();
  const isMacAddress = /^[0-9a-f]{12}$/i.test(cleanMac);
  const isBluetoothName = portNameOrMac.toLowerCase().includes('bluetooth') || 
                          portNameOrMac.toLowerCase().includes('mpt');

  if (isMacAddress || isBluetoothName) {
    logger.info(`[sendRawBytesToSerialPort] Routing Bluetooth target "${portNameOrMac}" through WinRT RFCOMM socket...`);
    const macHex = isMacAddress ? cleanMac : '606E4101486A';
    const winRtRes = await sendRawBytesToWinRtBluetooth(macHex, data, jobLabel);
    if (winRtRes.success) {
      return winRtRes;
    }
    logger.warn(`[sendRawBytesToSerialPort] WinRT RFCOMM fallback notice: ${winRtRes.message}. Trying direct serial port.`);
  }

  const scriptPath = path.join(os.tmpdir(), 'seznik_serial_direct_shared.ps1');
  const tempFile = path.join(os.tmpdir(), `seznik_serial_payload_${Date.now()}.bin`);

  try {
    fs.writeFileSync(scriptPath, DIRECT_SERIAL_SCRIPT_CONTENT, 'utf-8');
    fs.writeFileSync(tempFile, data);

    const cleanPort = portNameOrMac.replace(/:/g, '').trim();
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PortName "${cleanPort}" -FilePath "${tempFile}"`;
    await execPromise(psCmd, { timeout: 15000 });

    logger.info(`[DirectSerialPrint] Delivered ${data.length} bytes to serial port "${cleanPort}" directly ✓`);
    return { success: true, message: `${jobLabel} (${data.length} bytes) delivered to ${cleanPort} directly.` };
  } catch (err: any) {
    const detail: string = err.stderr || err.message || 'Unknown Serial error';
    logger.error(`[DirectSerialPrint ERROR] Failed writing to "${portNameOrMac}": ${detail}`);
    return { success: false, message: detail };
  } finally {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
  }
}
