import { BrowserWindow } from 'electron';
import logger from '../logger';
import { BluetoothDiscoveryService } from './BluetoothDiscoveryService';
import { BluetoothPrinterTransport } from './transport/BluetoothPrinterTransport';
import { PrinterPersistenceService } from './PrinterPersistenceService';
import { BluetoothConnectionState, BluetoothPairedDevice } from '../../shared/types';

// Normalizes a device id/mac-address into a stable, comparable key (used both
// when deriving the persisted SavedPrinter id and when matching a requested
// deviceId back to a freshly-scanned BluetoothPairedDevice). Must be applied
// consistently everywhere an id round-trips through persistence, or a saved
// device without a resolvable MAC (id like "bt-my-printer") won't be found
// again after its hyphens/case are lost in storage.
function normalizeDeviceKey(raw: string): string {
  return (raw || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

// The Windows printer queue name we register for a paired device — this is
// exactly what shows up in every app's Print dialog (Ctrl+P), not just inside
// SEZNIK, so keep it recognizable.
function buildQueueName(deviceName: string): string {
  return `${deviceName} (Bluetooth)`;
}

function buildBluetoothTestReceipt(deviceName: string): Buffer {
  const dateStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString();
  const payload =
    '\x1B\x40' + // Init
    '\x1B\x61\x01' + // Center
    'SEZNIK POS STORE\r\n' +
    '--------------------------------\r\n' +
    'BLUETOOTH TEST RECEIPT\r\n' +
    '--------------------------------\r\n' +
    '\x1B\x61\x00' + // Left
    `Device: ${deviceName}\r\n` +
    `Date: ${dateStr}  ${timeStr}\r\n` +
    'Link: Bluetooth SPP (Windows Printer Queue)\r\n' +
    'Status: WIRELESS PRINT VERIFIED\r\n' +
    '--------------------------------\r\n' +
    '\x1B\x61\x01' + // Center
    'THANK YOU FOR USING SEZNIK!\r\n\r\n\r\n' +
    '\x1D\x56\x00'; // Cut
  return Buffer.from(payload, 'latin1');
}

const INITIAL_STATE: BluetoothConnectionState = {
  step: 'IDLE',
  stepMessage: 'Bluetooth printer not connected yet.',
  devices: [],
  isScanning: false,
  connectedDeviceId: null,
  connectedDeviceName: null,
  connectedComPort: null,
  connectedQueueName: null,
  connectedDriverName: null,
  testPrintSuccess: false,
  lastTestPrintMessage: null,
};

export class BluetoothPrinterService {
  private discovery: BluetoothDiscoveryService;
  private transport: BluetoothPrinterTransport;
  private persistence: PrinterPersistenceService;
  private state: BluetoothConnectionState = { ...INITIAL_STATE, devices: [] };
  private window: BrowserWindow | null = null;

  constructor() {
    this.discovery = new BluetoothDiscoveryService();
    this.transport = new BluetoothPrinterTransport();
    this.persistence = new PrinterPersistenceService();
  }

  setWindow(win: BrowserWindow) {
    this.window = win;
  }

  getState(): BluetoothConnectionState {
    return { ...this.state };
  }

  private updateState(partial: Partial<BluetoothConnectionState>): BluetoothConnectionState {
    this.state = { ...this.state, ...partial };
    logger.info(`[BluetoothPrinterService] State -> [${this.state.step}] ${this.state.stepMessage}`);
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('event:bluetoothStateChanged', this.state);
    }
    return this.getState();
  }

  /**
   * Lists Windows-paired Bluetooth devices so the user can pick their
   * printer. Called from the "Connect via Bluetooth" screen after USB setup
   * has completed, and again from Settings for reconnects.
   */
  async scanPairedDevices(): Promise<BluetoothConnectionState> {
    this.updateState({ step: 'SCANNING', stepMessage: 'Scanning Windows-paired Bluetooth devices...', isScanning: true });

    try {
      const devices = await this.discovery.getPairedDevices();
      if (devices.length === 0) {
        return this.updateState({
          step: 'NO_DEVICES_FOUND',
          stepMessage: 'No paired Bluetooth devices found. Pair your printer in Windows Bluetooth settings first.',
          devices: [],
          isScanning: false,
        });
      }
      return this.updateState({
        step: 'DEVICES_FOUND',
        stepMessage: `Found ${devices.length} paired Bluetooth device(s).`,
        devices,
        isScanning: false,
      });
    } catch (err: any) {
      logger.error(`[BluetoothPrinterService] scanPairedDevices failed: ${err.message}`);
      return this.updateState({
        step: 'ERROR',
        stepMessage: `Bluetooth scan failed: ${err.message}`,
        isScanning: false,
        errorDetails: err.message,
      });
    }
  }

  private findDevice(devices: BluetoothPairedDevice[], deviceId: string): BluetoothPairedDevice | undefined {
    const key = normalizeDeviceKey(deviceId);
    return devices.find(d => normalizeDeviceKey(d.id) === key || (d.address && normalizeDeviceKey(d.address) === key));
  }

  /**
   * Connects to a previously-scanned paired device by id: registers a real
   * Windows printer queue on its COM port (so it shows up in every app's
   * Print dialog, including Ctrl+P), then immediately fires one automatic
   * test receipt through that same queue to confirm it actually prints.
   */
  async connectDevice(deviceId: string): Promise<BluetoothConnectionState> {
    let device: BluetoothPairedDevice | undefined = this.findDevice(this.state.devices, deviceId);

    if (!device) {
      // Device list may be stale (e.g. user re-opened the modal) — rescan once.
      const rescanned = await this.discovery.getPairedDevices();
      this.updateState({ devices: rescanned });
      device = this.findDevice(rescanned, deviceId);
    }

    if (!device) {
      return this.updateState({
        step: 'ERROR',
        stepMessage: 'Selected Bluetooth device is no longer available. Please rescan.',
        errorDetails: 'DEVICE_NOT_FOUND',
      });
    }

    if (!device.comPort) {
      return this.updateState({
        step: 'ERROR',
        stepMessage: `"${device.name}" is paired but Windows hasn't bound a serial port to it yet. Open Windows Bluetooth settings, remove and re-pair the printer, and make sure "Serial Port" / SPP service is enabled, then rescan.`,
        errorDetails: 'NO_COM_PORT',
      });
    }

    const queueName = buildQueueName(device.name);

    this.updateState({
      step: 'CONNECTING',
      stepMessage: `Registering "${device.name}" as a Windows printer on ${device.comPort}...`,
    });

    const registerResult = await this.transport.registerPrinterQueue(device.comPort, queueName);
    if (!registerResult.success) {
      return this.updateState({
        step: 'ERROR',
        stepMessage: registerResult.message,
        errorDetails: registerResult.message,
      });
    }

    this.updateState({
      step: 'CONNECTED',
      stepMessage: `${registerResult.message} Look for "${queueName}" in any app's Print dialog (Ctrl+P).`,
      connectedDeviceId: device.id,
      connectedDeviceName: device.name,
      connectedComPort: device.comPort,
      connectedQueueName: queueName,
      connectedDriverName: registerResult.driverUsed,
      testPrintSuccess: false,
      lastTestPrintMessage: null,
    });

    // Persist so the printer reappears (and can be reconnected/forgotten) in Settings.
    // `name` mirrors the registered Windows queue name so future writes/print
    // actions elsewhere in the app can target it directly, same as the USB flow.
    try {
      await this.persistence.saveOrUpdatePrinter({
        id: `seznik-bt-${normalizeDeviceKey(device.id)}`,
        name: queueName,
        driverName: registerResult.driverUsed,
        portName: device.comPort,
        connectionType: 'BLUETOOTH',
        isDefault: false,
        printerType: 'RECEIPT',
        macAddress: device.address,
      });
    } catch (persistErr: any) {
      logger.warn(`[BluetoothPrinterService] Failed to persist Bluetooth printer: ${persistErr.message}`);
    }

    // Automatically fire the test receipt as part of the connect flow.
    return this.triggerTestPrint();
  }

  async triggerTestPrint(): Promise<BluetoothConnectionState> {
    const queueName = this.state.connectedQueueName;
    const deviceName = this.state.connectedDeviceName || 'Bluetooth Printer';

    if (!queueName) {
      return this.updateState({
        step: 'ERROR',
        stepMessage: 'No connected Bluetooth printer to test. Connect a device first.',
        errorDetails: 'NOT_CONNECTED',
      });
    }

    this.updateState({ step: 'TEST_PRINTING', stepMessage: `Sending test receipt to "${queueName}"...` });

    const payload = buildBluetoothTestReceipt(deviceName);
    const result = await this.transport.write(queueName, payload);

    if (result.success) {
      return this.updateState({
        step: 'TEST_PRINT_SUCCESS',
        stepMessage: `Test receipt sent to "${queueName}" ✓ Check the physical printout.`,
        testPrintSuccess: true,
        lastTestPrintMessage: `Test receipt (${payload.length} bytes) delivered to "${queueName}" via the Windows print queue ✓`,
      });
    }

    return this.updateState({
      step: 'TEST_PRINT_FAILED',
      stepMessage: `Test receipt failed: ${result.errorMessage || 'Unknown error'}`,
      testPrintSuccess: false,
      lastTestPrintMessage: result.errorMessage || 'Unknown error',
      errorDetails: result.errorMessage,
    });
  }

  /**
   * Clears SEZNIK's own "currently selected" indicator only. The Windows
   * printer queue registered by connectDevice() is left installed — that's
   * the whole point, so it keeps working from Ctrl+P and other apps even
   * when SEZNIK isn't actively "connected" to it. Use forgetDevice() to
   * actually uninstall the queue.
   */
  disconnect(): BluetoothConnectionState {
    return this.updateState({
      step: 'DISCONNECTED',
      stepMessage: this.state.connectedQueueName
        ? `Deselected in SEZNIK. "${this.state.connectedQueueName}" remains installed in Windows — it's still usable from Ctrl+P in any app.`
        : 'Bluetooth printer disconnected.',
      connectedDeviceId: null,
      connectedDeviceName: null,
      connectedComPort: null,
      connectedQueueName: null,
      connectedDriverName: null,
      testPrintSuccess: false,
      lastTestPrintMessage: null,
    });
  }

  /** Fully uninstalls the Windows printer queue and removes the saved record (does not un-pair Bluetooth). */
  async forgetDevice(deviceId: string): Promise<BluetoothConnectionState> {
    const savedId = `seznik-bt-${normalizeDeviceKey(deviceId)}`;
    try {
      const saved = await this.persistence.getSavedPrinters();
      const record = saved.find(p => p.id === savedId);
      if (record) {
        await this.transport.removePrinterQueue(record.name);
      }
      await this.persistence.removeSavedPrinter(savedId);
    } catch (err: any) {
      logger.warn(`[BluetoothPrinterService] forgetDevice cleanup notice: ${err.message}`);
    }

    if (this.state.connectedDeviceId && normalizeDeviceKey(this.state.connectedDeviceId) === normalizeDeviceKey(deviceId)) {
      return this.disconnect();
    }
    return this.getState();
  }
}
