import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import logger from '../../logger';
import { PrintResult } from '../../../shared/types';
import { sendRawBytesToPrinterQueue, sendRawBytesToSerialPort } from '../util/WinSpoolRawPrint';

const execPromise = util.promisify(exec);

// ============================================================================
// A Bluetooth SPP printer only really "exists" to the rest of Windows once it
// is registered as a normal printer QUEUE bound to its "Standard Serial over
// Bluetooth link (COMx)" port — exactly like a USB or network printer. Once
// that queue exists, it shows up in every app's Print dialog (Ctrl+P), and
// Windows' own spooler owns opening/closing the COM port per job, so there is
// no conflict with other apps (or SEZNIK) printing to it at the same time.
//
// An earlier version of this transport tried to hold the COM port open
// itself to keep the Bluetooth link "alive" — that's exactly backwards: it
// blocked the Windows spooler from ever reaching the port, which is why the
// printer never showed up for Ctrl+P printing. Don't reintroduce that.
// ============================================================================

export interface RegisterQueueResult {
  success: boolean;
  message: string;
  driverUsed: string;
}

export class BluetoothPrinterTransport {
  /** Local Port monitor naming convention Windows uses for serial ports (e.g. "COM5:"). */
  private toLocalPortName(comPort: string): string {
    return comPort.endsWith(':') ? comPort : `${comPort}:`;
  }

  /**
   * Finds an already-installed printer driver that looks like a real VEER /
   * POS58 thermal receipt driver (e.g. one the USB setup pipeline installed
   * earlier) so Ctrl+P image/photo jobs get rasterized correctly instead of
   * being silently dropped by a text-only driver.
   */
  private async findPreferredDriver(): Promise<string | null> {
    if (os.platform() !== 'win32') return null;
    try {
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PrinterDriver -ErrorAction SilentlyContinue | Select-Object Name | ConvertTo-Json"`;
      const { stdout } = await execPromise(psCmd);
      if (stdout && stdout.trim() !== '') {
        const parsed = JSON.parse(stdout);
        const list: any[] = Array.isArray(parsed) ? parsed : [parsed];
        const found = list.find((d: any) => {
          const n = String(d.Name || '').toLowerCase();
          return n.includes('pos58') || n.includes('pos-58') || n.includes('58mm') || n.includes('veer') || n.includes('pos80') || n.includes('80mm');
        });
        if (found?.Name) return found.Name;
      }

      // If no thermal raster driver is installed, auto-install POS58 driver package
      logger.info('[BluetoothPrinterTransport] No thermal raster driver found in Windows. Auto-installing POS58 driver package...');
      const { DriverManager } = await import('../DriverManager');
      const driverMgr = new DriverManager();
      await driverMgr.installDriverAutomatically('VEER');

      // Re-check after installation
      const { stdout: afterStdout } = await execPromise(psCmd);
      if (afterStdout && afterStdout.trim() !== '') {
        const parsedAfter = JSON.parse(afterStdout);
        const listAfter: any[] = Array.isArray(parsedAfter) ? parsedAfter : [parsedAfter];
        const foundAfter = listAfter.find((d: any) => {
          const n = String(d.Name || '').toLowerCase();
          return n.includes('pos58') || n.includes('pos-58') || n.includes('58mm') || n.includes('veer');
        });
        if (foundAfter?.Name) return foundAfter.Name;
      }
      return 'POS58';
    } catch (err: any) {
      logger.warn(`[BluetoothPrinterTransport] Driver discovery notice: ${err.message}`);
      return 'POS58';
    }
  }

  /**
   * Ensures a real Windows printer queue exists on the given Bluetooth COM
   * port. Idempotent — safe to call again to "reconnect" or rebind after the
   * COM port number changes across a re-pair.
   */
  async registerPrinterQueue(comPort: string, queueName: string): Promise<RegisterQueueResult> {
    if (os.platform() !== 'win32') {
      return { success: false, message: 'Bluetooth printer registration is only supported on Windows.', driverUsed: '' };
    }

    const portName = this.toLocalPortName(comPort);
    const preferredDriver = await this.findPreferredDriver();
    const driverName = preferredDriver || 'POS58';

    // Escape single quotes defensively — printer/device display names can contain them.
    const esc = (s: string) => s.replace(/'/g, "''");

    try {
      // Discover current default printer beforehand so we can preserve it
      let currentDefaultPrinter = '';
      try {
        const { stdout: defStdout } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-CimInstance Win32_Printer -Filter 'Default=True' -ErrorAction SilentlyContinue).Name"`);
        currentDefaultPrinter = (defStdout || '').trim();
      } catch {}

      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "
        $ErrorActionPreference='Stop';
        Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows' -Name 'LegacyDefaultPrinterMode' -Value 1 -Type DWord -Force;
        if (-not (Get-PrinterPort -Name '${esc(portName)}' -ErrorAction SilentlyContinue)) { Add-PrinterPort -Name '${esc(portName)}' };
        if (-not (Get-Printer -Name '${esc(queueName)}' -ErrorAction SilentlyContinue)) {
          Add-Printer -Name '${esc(queueName)}' -DriverName '${esc(driverName)}' -PortName '${esc(portName)}' -PrintProcessor 'winprint' -DataType 'RAW'
        } else {
          Set-Printer -Name '${esc(queueName)}' -DriverName '${esc(driverName)}' -PortName '${esc(portName)}' -PrintProcessor 'winprint' -DataType 'RAW'
        }
      "`;
      await execPromise(psCmd, { timeout: 20000 });

      // If there was an existing default printer and it wasn't this queue, preserve it
      if (currentDefaultPrinter && currentDefaultPrinter.toLowerCase() !== queueName.toLowerCase()) {
        try {
          const restorePs = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; (New-Object -ComObject WScript.Network).SetDefaultPrinter('${esc(currentDefaultPrinter)}'); (Get-WmiObject -Class Win32_Printer -Filter \\"Name='${esc(currentDefaultPrinter)}'\\").SetDefaultPrinter()"`;
          await execPromise(restorePs);
          logger.info(`[BluetoothPrinterTransport] Preserved existing default printer: "${currentDefaultPrinter}"`);
        } catch {}
      }

      logger.info(`[BluetoothPrinterTransport] Registered Windows printer "${queueName}" on port "${portName}" using driver "${driverName}" ✓ (supports full image rasterization in Ctrl+P)`);
      return {
        success: true,
        message: `"${queueName}" configured as a Windows printer on ${portName} using ${driverName} driver (full image & document rasterization enabled).`,
        driverUsed: driverName,
      };
    } catch (err: any) {
      const detail: string = err.stderr || err.message || 'Unknown error';
      logger.error(`[BluetoothPrinterTransport] Failed to register Windows printer queue "${queueName}": ${detail}`);
      return { success: false, message: `Could not register "${queueName}" as a Windows printer: ${detail}`, driverUsed: driverName };
    }
  }

  /** Fully uninstalls the queue (used by "Forget device") — removes it from Ctrl+P everywhere. */
  async removePrinterQueue(queueName: string): Promise<void> {
    if (os.platform() !== 'win32') return;
    try {
      const esc = queueName.replace(/'/g, "''");
      await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Remove-Printer -Name '${esc}' -ErrorAction SilentlyContinue"`);
      logger.info(`[BluetoothPrinterTransport] Removed Windows printer queue "${queueName}".`);
    } catch (err: any) {
      logger.warn(`[BluetoothPrinterTransport] Notice removing queue "${queueName}": ${err.message}`);
    }
  }

  async isQueueReady(queueName: string): Promise<boolean> {
    if (os.platform() !== 'win32') return false;
    try {
      const esc = queueName.replace(/'/g, "''");
      const { stdout } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -Command "[bool](Get-Printer -Name '${esc}' -ErrorAction SilentlyContinue)"`);
      return stdout.trim().toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  /** Sends raw ESC/POS bytes directly over the Bluetooth COM port or via the Windows queue. */
  async write(queueName: string, data: Buffer, comPort?: string | null): Promise<PrintResult> {
    let res: { success: boolean; message: string } = { success: false, message: 'Initial write' };

    // Auto-ensure queue is registered in Windows Spooler if missing
    let targetPort = comPort;
    if (!targetPort) {
      try {
        const psGetCom = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PnpDevice -Class Ports -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -like '*Bluetooth*' -or $_.InstanceId -like 'BTHENUM*' } | Select-Object FriendlyName | ConvertTo-Json"`;
        const { stdout } = await execPromise(psGetCom);
        if (stdout && stdout.trim() !== '') {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            const m = String(item.FriendlyName || '').match(/\(COM(\d+)\)/i);
            if (m) {
              targetPort = `COM${m[1]}`;
              break;
            }
          }
        }
      } catch (e) {}
    }

    const isReady = await this.isQueueReady(queueName);
    if (!isReady && targetPort) {
      logger.info(`[BluetoothPrinterTransport] Printer queue "${queueName}" not found in OS Spooler. Auto-registering on ${targetPort}...`);
      await this.registerPrinterQueue(targetPort, queueName);
    }

    if (targetPort) {
      // Primary: Win32 direct serial transmission to Bluetooth port
      res = await sendRawBytesToSerialPort(targetPort, data, 'SEZNIK Bluetooth Print Job');
      if (!res.success) {
        logger.warn(`[BluetoothPrinterTransport] Direct serial write to ${targetPort} notice: ${res.message}. Trying Windows Spooler queue "${queueName}"...`);
        res = await sendRawBytesToPrinterQueue(queueName, data, 'SEZNIK Bluetooth Print Job');
      }
    } else {
      res = await sendRawBytesToPrinterQueue(queueName, data, 'SEZNIK Bluetooth Print Job');
    }

    if (!res.success) {
      // If spooler or serial port failed, attempt direct True BLE GATT transmission
      logger.info(`[BluetoothPrinterTransport] Spooler write notice: ${res.message}. Attempting True BLE GATT transmission...`);
      try {
        const { BleTransportFactory } = await import('./BleTransportFactory');
        const bleTransport = BleTransportFactory.getTransport();
        const bleRes = await bleTransport.writeReceiptBuffer(data, `BLE Print Job: ${queueName}`);
        if (bleRes.success) {
          res = { success: true, message: bleRes.message };
        }
      } catch (bleErr: any) {
        logger.warn(`[BluetoothPrinterTransport] BLE GATT fallback notice: ${bleErr.message}`);
      }
    }

    return {
      success: res.success,
      printerId: queueName,
      platform: process.platform,
      queueName,
      bytesSent: res.success ? data.length : 0,
      errorCode: res.success ? undefined : 'BT_WRITE_FAILED',
      errorMessage: res.success ? undefined : res.message,
    };
  }
}
