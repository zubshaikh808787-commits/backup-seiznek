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
      if (!stdout || stdout.trim() === '') return null;
      const parsed = JSON.parse(stdout);
      const list: any[] = Array.isArray(parsed) ? parsed : [parsed];
      const found = list.find((d: any) => {
        const n = String(d.Name || '').toLowerCase();
        return n.includes('pos58') || n.includes('pos-58') || n.includes('58mm') || n.includes('veer');
      });
      return found?.Name || null;
    } catch (err: any) {
      logger.warn(`[BluetoothPrinterTransport] Driver discovery notice: ${err.message}`);
      return null;
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
    const driverName = preferredDriver || 'Generic / Text Only';

    // Escape single quotes defensively — printer/device display names can contain them.
    const esc = (s: string) => s.replace(/'/g, "''");

    try {
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; if (-not (Get-PrinterPort -Name '${esc(portName)}' -ErrorAction SilentlyContinue)) { Add-PrinterPort -Name '${esc(portName)}' }; if (-not (Get-Printer -Name '${esc(queueName)}' -ErrorAction SilentlyContinue)) { Add-Printer -Name '${esc(queueName)}' -DriverName '${esc(driverName)}' -PortName '${esc(portName)}' } else { Set-Printer -Name '${esc(queueName)}' -PortName '${esc(portName)}' }"`;
      await execPromise(psCmd, { timeout: 20000 });

      logger.info(`[BluetoothPrinterTransport] Registered Windows printer "${queueName}" on port "${portName}" using driver "${driverName}" ✓ (visible in Ctrl+P everywhere)`);
      return {
        success: true,
        message: preferredDriver
          ? `"${queueName}" installed as a Windows printer on ${portName} using the ${driverName} driver — photos and documents will print correctly.`
          : `"${queueName}" installed as a Windows printer on ${portName} using the built-in Generic / Text Only driver — plain text prints fine, but photos/images won't render (no vendor thermal driver is installed yet; run USB setup once to get one).`,
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
    let res: { success: boolean; message: string };

    if (comPort) {
      // Direct Win32 serial communication over Bluetooth RFCOMM bypasses Windows spooler timeout
      res = await sendRawBytesToSerialPort(comPort, data, 'SEZNIK Bluetooth Print Job');
      if (!res.success) {
        logger.warn(`[BluetoothPrinterTransport] Direct serial port write to ${comPort} failed, trying Windows queue "${queueName}"...`);
        res = await sendRawBytesToPrinterQueue(queueName, data, 'SEZNIK Bluetooth Print Job');
      }
    } else {
      res = await sendRawBytesToPrinterQueue(queueName, data, 'SEZNIK Bluetooth Print Job');
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
