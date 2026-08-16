import { BrowserWindow } from 'electron';
import logger from '../logger';
import { 
  VeerBleDevice, 
  VeerBleStatus, 
  VeerBlePrintResult 
} from '../../shared/types';
import { BleTransportFactory } from './transport/BleTransportFactory';
import { VeerReceiptCommandGenerator } from './commands/VeerReceiptCommandGenerator';
import { DriverManager } from './DriverManager';
import { NativeBleSpoolerBridge } from './transport/NativeBleSpoolerBridge';

export class VeerBleService {
  private transport = BleTransportFactory.getTransport();
  private driverManager = new DriverManager();
  private spoolerBridge = NativeBleSpoolerBridge.getInstance();
  private window: BrowserWindow | null = null;
  private autoReconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.transport.setStatusCallback((status) => {
      this.broadcastStatus(status);
      this.handleStateChange(status);
    });
    // Start background Windows Spooler BLE bridge
    this.spoolerBridge.startWatcher();
  }

  setWindow(win: BrowserWindow) {
    this.window = win;
  }

  private broadcastStatus(status: VeerBleStatus) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('veerBle:statusChanged', status);
    }
  }

  private handleStateChange(status: VeerBleStatus) {
    if (status.state === 'DISCONNECTED' && status.deviceId) {
      logger.warn(`[VeerBleService] Connection lost to device "${status.deviceName || status.deviceId}". Auto-reconnect standby active...`);
    }
  }

  async scan(): Promise<{ success: boolean; devices: VeerBleDevice[]; message: string }> {
    logger.info('[VeerBleService] Scan requested by client...');
    return this.transport.scan();
  }

  async connect(deviceId: string): Promise<{ success: boolean; status: VeerBleStatus; message: string }> {
    logger.info(`[VeerBleService] Connect requested for deviceId: "${deviceId}"...`);
    const res = await this.transport.connect(deviceId);
    if (res.success) {
      // Auto-configure Windows OS Printer queue
      this.setupOsPrinter('VEER POS58 (BLE)').catch(() => {});
    }
    return res;
  }

  async setupOsPrinter(queueName = 'VEER POS58 (BLE)'): Promise<{ success: boolean; message: string; queueName: string }> {
    logger.info(`[VeerBleService] Setting up Windows OS Printer queue "${queueName}"...`);
    const driverRes = await this.driverManager.installVeerBlePrinterQueue(queueName);
    this.spoolerBridge.startWatcher();
    return {
      success: driverRes.success,
      message: driverRes.log,
      queueName: driverRes.queueName,
    };
  }

  async disconnect(): Promise<{ success: boolean; message: string }> {
    logger.info('[VeerBleService] Disconnect requested...');
    if (this.autoReconnectTimer) {
      clearInterval(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }
    return this.transport.disconnect();
  }

  getStatus(): VeerBleStatus {
    return this.transport.getStatus();
  }

  async testPrint(): Promise<VeerBlePrintResult> {
    logger.info('[VeerBleService] Real BLE Test Print requested...');
    const currentStatus = this.getStatus();

    if (currentStatus.state !== 'READY' && currentStatus.state !== 'CONNECTED') {
      logger.warn('[VeerBleService] Device not READY. Attempting auto-reconnect scan...');
      const scanRes = await this.scan();
      const veerDev = scanRes.devices.find(d => d.isVeer);

      if (veerDev) {
        const connRes = await this.connect(veerDev.id);
        if (!connRes.success) {
          return {
            success: false,
            state: this.getStatus().state,
            errorCode: 'BLE_CONNECTION_FAILED',
            message: `BLE Test Print failed: Could not connect to VEER printer "${veerDev.name}".`,
          };
        }
      } else {
        return {
          success: false,
          state: this.getStatus().state,
          errorCode: 'VEER_NOT_FOUND',
          message: 'BLE Test Print failed: No verified VEER printer found in range.',
        };
      }
    }

    // Send through Native Spooler BLE Bridge
    const spoolRes = await this.spoolerBridge.sendWindowsTestPrintToQueue('VEER POS58 (BLE)');
    if (spoolRes.success) {
      return {
        success: true,
        state: 'PRINT_SUCCESS',
        message: spoolRes.message,
      };
    }

    return this.transport.testPrint();
  }

  async print(receiptDataHexOrAscii?: string): Promise<VeerBlePrintResult> {
    logger.info('[VeerBleService] Client print requested...');
    
    let bufferToPrint: Buffer;
    if (receiptDataHexOrAscii && receiptDataHexOrAscii.trim() !== '') {
      const trimmed = receiptDataHexOrAscii.trim();
      if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
        bufferToPrint = Buffer.from(trimmed, 'hex');
      } else {
        bufferToPrint = Buffer.from(trimmed, 'latin1');
      }
    } else {
      bufferToPrint = VeerReceiptCommandGenerator.createTestReceipt();
    }

    const currentStatus = this.getStatus();
    if (currentStatus.state !== 'READY' && currentStatus.state !== 'CONNECTED') {
      logger.warn('[VeerBleService] Connection not ready for print. Attempting auto-reconnect...');
      const scanRes = await this.scan();
      const veerDev = scanRes.devices.find(d => d.isVeer);

      if (veerDev) {
        const connRes = await this.connect(veerDev.id);
        if (!connRes.success) {
          return {
            success: false,
            state: this.getStatus().state,
            errorCode: 'BLE_CONNECTION_FAILED',
            message: 'Print failed: BLE Connection unavailable.',
          };
        }
      } else {
        return {
          success: false,
          state: this.getStatus().state,
          errorCode: 'VEER_NOT_FOUND',
          message: 'Print failed: No VEER printer available via BLE.',
        };
      }
    }

    return this.transport.writeReceiptBuffer(bufferToPrint, 'Client Receipt Print');
  }
}
