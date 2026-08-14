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

// Direct Win32 Serial Port streaming for Bluetooth SPP / RFCOMM ports (e.g. COM4).
// Bypasses the Windows Spooler service timeout to stream ESC/POS bytes directly.
const DIRECT_SERIAL_SCRIPT_CONTENT = `param(
    [string]$PortName,
    [string]$FilePath
)

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

        string cleanPort = portName.Replace(":", "").Trim();
        string devicePath = @"\\\\.\\" + cleanPort;

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

$res = [DirectSerialPrinterHelper]::SendFileToPort($PortName, $FilePath)
if (-not $res) {
    Write-Warning "Direct serial write returned false for $PortName."
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
    const detail: string = err.stderr || err.message || 'Unknown WinSpool error';
    logger.error(`[WinSpoolRawPrint ERROR] Failed writing to "${queueName}": ${detail}`);
    return { success: false, message: detail };
  } finally {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
  }
}

export async function sendRawBytesToSerialPort(
  portName: string,
  data: Buffer,
  jobLabel = 'SEZNIK Direct Serial Print Job'
): Promise<{ success: boolean; message: string }> {
  if (os.platform() !== 'win32') {
    return { success: false, message: 'Serial port writes are only supported on Windows.' };
  }

  const scriptPath = path.join(os.tmpdir(), 'seznik_serial_direct_shared.ps1');
  const tempFile = path.join(os.tmpdir(), `seznik_serial_payload_${Date.now()}.bin`);

  try {
    fs.writeFileSync(scriptPath, DIRECT_SERIAL_SCRIPT_CONTENT, 'utf-8');
    fs.writeFileSync(tempFile, data);

    const cleanPort = portName.replace(/:/g, '').trim();
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PortName "${cleanPort}" -FilePath "${tempFile}"`;
    await execPromise(psCmd, { timeout: 15000 });

    logger.info(`[DirectSerialPrint] Delivered ${data.length} bytes to serial port "${cleanPort}" directly ✓`);
    return { success: true, message: `${jobLabel} (${data.length} bytes) delivered to ${cleanPort} directly.` };
  } catch (err: any) {
    const detail: string = err.stderr || err.message || 'Unknown Serial error';
    logger.error(`[DirectSerialPrint ERROR] Failed writing to "${portName}": ${detail}`);
    return { success: false, message: detail };
  } finally {
    try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
  }
}
