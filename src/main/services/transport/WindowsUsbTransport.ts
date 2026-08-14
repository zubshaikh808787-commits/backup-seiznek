import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../../logger';
import { sendRawBytesToSerialPort } from '../util/WinSpoolRawPrint';
import { UsbPrinterTransport } from './UsbPrinterTransport';
import { DetectedPrinter, PrintResult, V1PrinterProfileBrand } from '../../../shared/types';
import { PrinterCommandGenerator } from '../commands/PrinterCommandGenerator';

const execPromise = util.promisify(exec);

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
        di.pDocName = "SEZNIK Windows RAW Print Job";
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

export class WindowsUsbTransport implements UsbPrinterTransport {
  private activeConnections: Set<string> = new Set();

  async discover(): Promise<DetectedPrinter[]> {
    if (os.platform() !== 'win32') return [];

    logger.info('[WindowsUsbTransport] Querying physical Windows Spooler and USB Ports...');
    const detected: DetectedPrinter[] = [];

    try {
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name, DriverName, PortName, PrinterStatus, Default | ConvertTo-Json"`;
      const { stdout } = await execPromise(psCmd);

      if (stdout && stdout.trim() !== '') {
        const parsed = JSON.parse(stdout);
        const list: any[] = Array.isArray(parsed) ? parsed : [parsed];

        for (const prt of list) {
          const name = String(prt.Name || '');
          const drv = String(prt.DriverName || '');
          const lower = name.toLowerCase() + ' ' + drv.toLowerCase();

          let brand: V1PrinterProfileBrand = 'UNSUPPORTED';
          if (lower.includes('pos58') || lower.includes('pos-58') || lower.includes('veer') || lower.includes('receipt') || lower.includes('olivetti')) {
            brand = 'VEER';
          } else if (lower.includes('dp27') || lower.includes('josh') || lower.includes('ld0801') || lower.includes('label') || lower.includes('detong')) {
            brand = 'JOSH';
          } else if (lower.includes('dev') || lower.includes('sz-80d') || lower.includes('pos80')) {
            brand = 'DEV';
          }

          if (brand !== 'UNSUPPORTED') {
            const activePort = await this.resolveActiveUsbPort(brand, name);
            detected.push({
              printerId: `win-${name.replace(/\s+/g, '-').toLowerCase()}`,
              brand,
              name,
              queueName: name,
              portName: activePort || prt.PortName || 'USB001',
              driverName: drv,
              isReady: prt.PrinterStatus !== 7 && prt.PrinterStatus !== 2, // Not offline
              platform: 'win32',
            });
          }
        }
      }
    } catch (err: any) {
      logger.error(`[WindowsUsbTransport] Discovery error: ${err.message}`);
    }

    return detected;
  }

  async connect(printerId: string): Promise<void> {
    logger.info(`[WindowsUsbTransport] Connecting logical handle to printer: "${printerId}"`);
    this.activeConnections.add(printerId);
  }

  async disconnect(printerId: string): Promise<void> {
    logger.info(`[WindowsUsbTransport] Disconnecting logical handle for printer: "${printerId}"`);
    this.activeConnections.delete(printerId);
  }

  async isReady(printerId: string): Promise<boolean> {
    const printers = await this.discover();
    const found = printers.find(p => p.printerId === printerId || p.queueName.toLowerCase() === printerId.toLowerCase());
    return found ? found.isReady : false;
  }

  async write(printerId: string, data: Buffer): Promise<PrintResult> {
    logger.info(`[WindowsUsbTransport] Write invoked for printerId: "${printerId}" (${data.length} bytes)`);

    const printers = await this.discover();
    const matched = printers.find(
      p => p.printerId === printerId || p.queueName.toLowerCase() === printerId.toLowerCase() || printerId.toLowerCase().includes(p.queueName.toLowerCase())
    );

    const queueName = matched ? matched.queueName : (printerId.includes('POS58') || printerId.includes('VEER') ? 'POS58 Printer' : 'LD0801 Label Printer');
    const brand = matched ? matched.brand : (queueName.toLowerCase().includes('pos58') || queueName.toLowerCase().includes('veer') ? 'VEER' : 'JOSH');

    // Resolve active physical USB or serial port for device
    let activePort = await this.resolveActiveUsbPort(brand, queueName);
    if (!activePort && matched?.portName) {
      activePort = matched.portName;
    }
    logger.info(`[WindowsUsbTransport] Target Queue: "${queueName}" | Verified Active Port: "${activePort}"`);

    // Check if this is a Bluetooth serial COM port
    if (activePort.toLowerCase().startsWith('com') || queueName.toLowerCase().includes('bluetooth')) {
      logger.info(`[WindowsUsbTransport] Detected Bluetooth/Serial port "${activePort}". Using direct serial streaming.`);
      const serRes = await sendRawBytesToSerialPort(activePort, data, 'SEZNIK Bluetooth Print Job');
      
      // Cleanup any stuck jobs
      setTimeout(async () => {
        try {
          const psCleanup = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Get-Printer -Name '${queueName}' -ErrorAction SilentlyContinue | Get-PrintJob -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue"`;
          await execPromise(psCleanup);
        } catch (e) {}
      }, 500);

      return {
        success: serRes.success,
        printerId,
        platform: 'win32',
        queueName,
        portName: activePort,
        bytesSent: serRes.success ? data.length : 0,
        errorCode: serRes.success ? undefined : 'BT_WRITE_FAILED',
        errorMessage: serRes.success ? undefined : serRes.message,
      };
    }

    try {
      // Step 1: Pre-print Maintenance -> Clear stuck spooler error jobs & set queue port to active USB port
      const psPrep = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Get-Printer -Name '${queueName}' -ErrorAction SilentlyContinue | Get-PrintJob -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue; Set-Printer -Name '${queueName}' -PortName '${activePort}' -ErrorAction SilentlyContinue"`;
      await execPromise(psPrep).catch(() => {});

      // Step 2: Write raw payload to temp file
      const tempFile = path.join(os.tmpdir(), `seznik_win_raw_${Date.now()}.bin`);
      fs.writeFileSync(tempFile, data);

      // Step 3: Stream RAW binary bytes to Windows Spooler via winspool.drv API
      const rawScriptPath = path.join(os.tmpdir(), 'seznik_winspool_raw.ps1');
      fs.writeFileSync(rawScriptPath, RAW_PRINT_SCRIPT_CONTENT, 'utf-8');
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${rawScriptPath}" -PrinterName "${queueName}" -FilePath "${tempFile}"`;
      await execPromise(psCmd);
      logger.info(`[WindowsUsbTransport] WinSpool API write (${data.length} bytes) to "${queueName}" on "${activePort}" succeeded ✓`);

      // Step 4: Post-print Maintenance -> Clean up any stuck spooler error jobs created by vendor driver
      setTimeout(async () => {
        try {
          const psCleanup = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Get-Printer -Name '${queueName}' -ErrorAction SilentlyContinue | Get-PrintJob -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue"`;
          await execPromise(psCleanup);
        } catch (e) {}
      }, 500);

      // Cleanup temp binary file
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}

      logger.info(`[WindowsUsbTransport] RAW binary payload (${data.length} bytes) successfully delivered to "${queueName}" on "${activePort}" ✓`);

      return {
        success: true,
        printerId,
        platform: 'win32',
        queueName,
        portName: activePort,
        bytesSent: data.length,
      };
    } catch (err: any) {
      logger.error(`[WindowsUsbTransport ERROR] Write failed for "${queueName}": ${err.message}`);
      return {
        success: false,
        printerId,
        platform: 'win32',
        queueName,
        portName: activePort,
        bytesSent: 0,
        errorCode: 'USB_WRITE_FAILED',
        errorMessage: err.message,
      };
    }
  }

  async testPrint(printerId: string): Promise<PrintResult> {
    logger.info(`[WindowsUsbTransport] Executing test print for: "${printerId}"`);
    const brand: V1PrinterProfileBrand = printerId.toLowerCase().includes('pos58') || printerId.toLowerCase().includes('veer') ? 'VEER' : 'JOSH';
    const payload = PrinterCommandGenerator.generateTestPayload(brand);
    return this.write(printerId, payload);
  }

  private async resolveActiveUsbPort(brand: V1PrinterProfileBrand, queueName: string): Promise<string> {
    try {
      const psGetPorts = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PrinterPort -ErrorAction SilentlyContinue | Select-Object Name, Description | ConvertTo-Json"`;
      const { stdout } = await execPromise(psGetPorts);

      if (stdout && stdout.trim() !== '') {
        const parsed = JSON.parse(stdout);
        const portList: any[] = Array.isArray(parsed) ? parsed : [parsed];

        let currentPort = '';
        try {
          const { stdout: prtOut } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Printer -Name '${queueName}' -ErrorAction SilentlyContinue).PortName"`);
          if (prtOut && prtOut.trim()) currentPort = prtOut.trim();
        } catch (e) {}

        if (brand === 'VEER') {
          const specificPorts = portList.filter((p: any) => {
            const desc = String(p.Description || '').toLowerCase();
            const name = String(p.Name || '').toLowerCase();
            return desc.includes('olivetti') || desc.includes('prt80') || desc.includes('pos58') || desc.includes('veer') || desc.includes('58') || name.includes('pos58');
          });

          if (specificPorts.length > 0) {
            const matchCurrent = specificPorts.find((p: any) => String(p.Name || '').toLowerCase() === currentPort.toLowerCase());
            if (matchCurrent) return matchCurrent.Name;

            specificPorts.sort((a: any, b: any) => {
              const numA = parseInt(String(a.Name || '').replace(/\D/g, '') || '0', 10);
              const numB = parseInt(String(b.Name || '').replace(/\D/g, '') || '0', 10);
              return numA - numB;
            });
            return specificPorts[0].Name;
          }

          const genericUsbPorts = portList.filter((p: any) => {
            const desc = String(p.Description || '').toLowerCase();
            const name = String(p.Name || '').toLowerCase();
            return name.startsWith('usb') && !desc.includes('dp27') && !desc.includes('detong') && !desc.includes('josh') && desc !== 'virtual printer port for usb';
          });

          if (genericUsbPorts.length > 0) {
            return genericUsbPorts[0].Name;
          }
        } else if (brand === 'JOSH') {
          const joshPort = portList.find((p: any) => {
            const desc = String(p.Description || '').toLowerCase();
            return desc.includes('detong') || desc.includes('dp27') || desc.includes('josh') || desc.includes('ld0801');
          });
          if (joshPort) return joshPort.Name;
        }
      }
    } catch (e) {}
    return 'USB001';
  }
}
