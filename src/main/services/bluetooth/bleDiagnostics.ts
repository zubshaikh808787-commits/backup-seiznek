import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import logger from '../../logger';
import { JoshBleDiagnosticReport, OSPrinterInfo } from '../../../shared/types';
import { JoshBleScanner } from './bleScanner';
import { DtpWebSdkWrapper } from '../sdk/dtpweb';

const execPromise = util.promisify(exec);

export class JoshBleDiagnostics {
  private scanner: JoshBleScanner;
  private dtpWeb: DtpWebSdkWrapper;

  constructor() {
    this.scanner = new JoshBleScanner();
    this.dtpWeb = new DtpWebSdkWrapper();
  }

  /**
   * Compiles an exhaustive, real-time diagnostic report covering Windows Bluetooth Radios,
   * BLE devices, JOSH candidates, GATT services, DTPWeb local status, and Windows Spooler queues.
   */
  async generateFullReport(): Promise<JoshBleDiagnosticReport> {
    const timestamp = new Date().toISOString();
    logger.info('[JOSH][DIAGNOSTICS] Generating full developer diagnostic report...');

    // 1. Scan Bluetooth Radios in Windows
    let bluetoothRadios: Array<{ name: string; status: string; instanceId: string }> = [];
    let windowsBluetoothEnabled = false;

    if (os.platform() === 'win32') {
      try {
        const { stdout } = await execPromise(
          `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-PnpDevice -Class 'Bluetooth' -PresentOnly -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status, InstanceId | ConvertTo-Json"`
        );
        if (stdout && stdout.trim() !== '') {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          bluetoothRadios = list.map((r: any) => ({
            name: String(r.FriendlyName || 'Unknown Bluetooth Device'),
            status: String(r.Status || 'UNKNOWN'),
            instanceId: String(r.InstanceId || ''),
          }));
          windowsBluetoothEnabled = bluetoothRadios.some(r => r.status === 'OK');
        }
      } catch (err: any) {
        logger.warn(`[JOSH][DIAGNOSTICS] Radio scan notice: ${err.message}`);
      }
    }

    // 2. Scan BLE Candidates & all nearby devices
    const scanResult = await this.scanner.scanForJoshBleDevices(8000);

    // 3. Check DTPWeb Print Assistant Service
    const dtpWebCheck = await this.dtpWeb.checkPlugin();
    let dtpWebPrinters: any[] = [];
    if (dtpWebCheck.running) {
      dtpWebPrinters = await this.dtpWeb.getPrinters();
    }

    // 4. Query Windows Spooler Printers
    let windowsSpoolerPrinters: OSPrinterInfo[] = [];
    if (os.platform() === 'win32') {
      try {
        const { stdout } = await execPromise(
          `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, Status, Default, Shared | ConvertTo-Json"`
        );
        if (stdout && stdout.trim() !== '') {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          windowsSpoolerPrinters = list.map((p: any) => ({
            name: String(p.Name || ''),
            driverName: String(p.DriverName || ''),
            portName: String(p.PortName || ''),
            status: String(p.Status || 'READY'),
            isDefault: Boolean(p.Default),
            isShared: Boolean(p.Shared),
          }));
        }
      } catch (err: any) {
        logger.warn(`[JOSH][DIAGNOSTICS] Spooler query notice: ${err.message}`);
      }
    }

    const report: JoshBleDiagnosticReport = {
      timestamp,
      windowsBluetoothEnabled,
      bluetoothRadios,
      nearbyBleDevices: scanResult.allDevicesScanned,
      joshCandidates: scanResult.candidates,
      dtpWebServiceRunning: dtpWebCheck.running,
      dtpWebPort: dtpWebCheck.port,
      dtpWebPrinters,
      windowsSpoolerPrinters,
      recentLogs: [],
    };

    logger.info(`[JOSH][DIAGNOSTICS] Report compiled: BT Enabled: ${windowsBluetoothEnabled}, Candidates: ${scanResult.candidates.length}, Spooler Printers: ${windowsSpoolerPrinters.length}`);
    return report;
  }
}
