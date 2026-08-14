import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../../logger';

const execPromise = util.promisify(exec);

// Sends raw bytes to an installed Windows printer QUEUE (by name) via the
// winspool.drv RAW datatype — the same technique already used for USB
// printing (see WindowsUsbTransport / TestPrintService). Going through the
// named queue (instead of opening the underlying port ourselves) means
// Windows' spooler owns the port lifecycle, so the same queue is usable by
// any other app's Print dialog (Ctrl+P) at the same time, with no conflict.
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
