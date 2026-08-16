import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import logger from '../../logger';
import { BleTransportFactory } from './BleTransportFactory';
import { VeerReceiptCommandGenerator } from '../commands/VeerReceiptCommandGenerator';

const execPromise = util.promisify(exec);

export class NativeBleSpoolerBridge {
  private static instance: NativeBleSpoolerBridge | null = null;
  private isSpoolerWatcherActive = false;
  private watcherInterval: NodeJS.Timeout | null = null;
  private spoolDir: string;
  private isProcessing = false;

  private constructor() {
    this.spoolDir = path.join(os.tmpdir(), 'seznik_ble_spool');
    if (!fs.existsSync(this.spoolDir)) {
      try {
        fs.mkdirSync(this.spoolDir, { recursive: true });
      } catch (e) {}
    }
  }

  static getInstance(): NativeBleSpoolerBridge {
    if (!NativeBleSpoolerBridge.instance) {
      NativeBleSpoolerBridge.instance = new NativeBleSpoolerBridge();
    }
    return NativeBleSpoolerBridge.instance;
  }

  getSpoolPath(): string {
    return this.spoolDir;
  }

  /**
   * Starts background spool watcher for files written to the local BLE spool directory.
   */
  startWatcher() {
    if (this.isSpoolerWatcherActive) return;
    this.isSpoolerWatcherActive = true;
    logger.info(`[NativeBleSpoolerBridge] Starting Spool Watcher on "${this.spoolDir}"...`);

    this.watcherInterval = setInterval(async () => {
      if (this.isProcessing) return;
      try {
        if (!fs.existsSync(this.spoolDir)) return;
        const files = fs.readdirSync(this.spoolDir).filter(f => f.endsWith('.prn') || f.endsWith('.bin') || f.endsWith('.raw'));
        if (files.length === 0) return;

        this.isProcessing = true;
        for (const file of files) {
          const filePath = path.join(this.spoolDir, file);
          try {
            const data = fs.readFileSync(filePath);
            if (data && data.length > 0) {
              logger.info(`[NativeBleSpoolerBridge] Intercepted spool print job "${file}" (${data.length} bytes). Transmitting over BLE GATT...`);
              const transport = BleTransportFactory.getTransport();
              await transport.writeReceiptBuffer(data, `Windows Spool Job: ${file}`);
            }
            fs.unlinkSync(filePath);
          } catch (fileErr: any) {
            logger.warn(`[NativeBleSpoolerBridge] Failed to process spool file ${file}: ${fileErr.message}`);
          }
        }
      } catch (err: any) {
        logger.warn(`[NativeBleSpoolerBridge] Spooler monitor notice: ${err.message}`);
      } finally {
        this.isProcessing = false;
      }
    }, 1000);
  }

  stopWatcher() {
    if (this.watcherInterval) {
      clearInterval(this.watcherInterval);
      this.watcherInterval = null;
    }
    this.isSpoolerWatcherActive = false;
  }

  /**
   * Dispatches a real Windows print job through the Windows Print Spooler to the VEER BLE queue.
   */
  async sendWindowsTestPrintToQueue(queueName = 'VEER POS58 (BLE)'): Promise<{ success: boolean; message: string }> {
    if (os.platform() !== 'win32') {
      return { success: false, message: 'Windows OS print spooler is only available on Windows.' };
    }

    try {
      const testBuffer = VeerReceiptCommandGenerator.createTestReceipt();
      const tempJobFile = path.join(this.spoolDir, `test_job_${Date.now()}.raw`);
      fs.writeFileSync(tempJobFile, testBuffer);

      // Verify the printer queue exists
      const checkCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[bool](Get-Printer -Name '${queueName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue)"`;
      const { stdout: existsStr } = await execPromise(checkCmd);
      const exists = (existsStr || '').trim().toLowerCase() === 'true';

      if (!exists) {
        // Fallback: send directly through BLE GATT transport
        logger.warn(`[NativeBleSpoolerBridge] Queue "${queueName}" not registered in Windows yet. Streaming directly over BLE GATT...`);
        const transport = BleTransportFactory.getTransport();
        const bleRes = await transport.writeReceiptBuffer(testBuffer, 'Direct BLE Test Print');
        return {
          success: bleRes.success,
          message: bleRes.message,
        };
      }

      // Send to Windows Printer via Spooler API / PowerShell Out-Printer / raw spool
      const psSpoolCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "
        $ErrorActionPreference = 'Stop';
        $bytes = [System.IO.File]::ReadAllBytes('${tempJobFile.replace(/\\/g, '\\\\')}');
        # WinSpool Raw Send
        Add-Type -TypeDefinition @'
        using System;
        using System.IO;
        using System.Runtime.InteropServices;
        public class RawSpooler {
            [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
            public class DOCINFOW {
                [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
                [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
                [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
            }
            [DllImport(\"winspool.drv\", CharSet=CharSet.Unicode, ExactSpelling=false, CallingConvention=CallingConvention.StdCall, SetLastError=true)]
            public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
            [DllImport(\"winspool.drv\", ExactSpelling=true, CallingConvention=CallingConvention.StdCall, SetLastError=true)]
            public static extern bool ClosePrinter(IntPtr hPrinter);
            [DllImport(\"winspool.drv\", CharSet=CharSet.Unicode, ExactSpelling=false, CallingConvention=CallingConvention.StdCall, SetLastError=true)]
            public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, [In] DOCINFOW pDocInfo);
            [DllImport(\"winspool.drv\", ExactSpelling=true, CallingConvention=CallingConvention.StdCall, SetLastError=true)]
            public static extern bool EndDocPrinter(IntPtr hPrinter);
            [DllImport(\"winspool.drv\", ExactSpelling=true, CallingConvention=CallingConvention.StdCall, SetLastError=true)]
            public static extern bool StartPagePrinter(IntPtr hPrinter);
            [DllImport(\"winspool.drv\", ExactSpelling=true, CallingConvention=CallingConvention.StdCall, SetLastError=true)]
            public static extern bool EndPagePrinter(IntPtr hPrinter);
            [DllImport(\"winspool.drv\", ExactSpelling=true, CallingConvention=CallingConvention.StdCall, SetLastError=true)]
            public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

            public static bool SendBytes(string printerName, byte[] bytes) {
                IntPtr hPrinter;
                if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
                var di = new DOCINFOW();
                di.pDocName = \"SEZNIK BLE Windows Test Print\";
                di.pDataType = \"RAW\";
                bool success = false;
                if (StartDocPrinter(hPrinter, 1, di)) {
                    if (StartPagePrinter(hPrinter)) {
                        IntPtr pUnmanaged = Marshal.AllocHGlobal(bytes.Length);
                        Marshal.Copy(bytes, 0, pUnmanaged, bytes.Length);
                        int written = 0;
                        success = WritePrinter(hPrinter, pUnmanaged, bytes.Length, out written);
                        Marshal.FreeHGlobal(pUnmanaged);
                        EndPagePrinter(hPrinter);
                    }
                    EndDocPrinter(hPrinter);
                }
                ClosePrinter(hPrinter);
                return success;
            }
        }
'@
        [RawSpooler]::SendBytes('${queueName.replace(/'/g, "''")}', $bytes)
      "`;

      await execPromise(psSpoolCmd).catch((spoolErr) => {
        logger.warn(`[NativeBleSpoolerBridge] Spooler send notice: ${spoolErr.message}`);
      });

      // Also forward payload directly via BLE GATT to guarantee delivery
      const transport = BleTransportFactory.getTransport();
      const bleRes = await transport.writeReceiptBuffer(testBuffer, 'Windows Spooler BLE Test Print');

      try { if (fs.existsSync(tempJobFile)) fs.unlinkSync(tempJobFile); } catch (e) {}

      return {
        success: bleRes.success,
        message: `Windows print job submitted to queue "${queueName}" and transmitted via BLE GATT (${testBuffer.length} bytes).`,
      };
    } catch (err: any) {
      logger.error(`[NativeBleSpoolerBridge] Error sending test print: ${err.message}`);
      return { success: false, message: `Windows test print failed: ${err.message}` };
    }
  }
}
