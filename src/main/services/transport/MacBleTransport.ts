import logger from '../../logger';
import { 
  VeerBleDevice, 
  VeerBleStatus, 
  VeerBlePrintResult, 
  VeerBleConnectionState,
  VeerBleErrorCode 
} from '../../../shared/types';
import { VeerReceiptCommandGenerator } from '../commands/VeerReceiptCommandGenerator';
import { SDK_VEER_SERVICE_UUIDS, SDK_VEER_CHARACTERISTIC_UUIDS } from './WindowsBleTransport';

export class MacBleTransport {
  private noble: any = null;
  private activePeripheral: any = null;
  private writeCharacteristic: any = null;
  
  private currentState: VeerBleConnectionState = 'DISCONNECTED';
  private currentDeviceId: string | null = null;
  private currentDeviceName: string | null = null;
  private currentServiceUuid: string | null = null;
  private currentCharacteristicUuid: string | null = null;
  private currentMtu = 180; // macOS CoreBluetooth default MTU payload size
  private lastErrorMessage: string | null = null;
  private lastErrorCode: VeerBleErrorCode | null = null;
  private lastPrintSuccess = false;

  private statusChangeCallback: ((status: VeerBleStatus) => void) | null = null;
  private discoveredDevices: Map<string, VeerBleDevice> = new Map();

  constructor() {
    this.initNoble();
  }

  private initNoble() {
    try {
      this.noble = require('@abandonware/noble');
      this.noble.on('stateChange', (state: string) => {
        logger.info(`[BLE-MAC] CoreBluetooth adapter state: ${state}`);
        if (state === 'unauthorized') {
          this.updateState('ERROR', 'macOS Bluetooth permission denied by user.', 'BLE_PERMISSION_DENIED');
        } else if (state !== 'poweredOn' && this.currentState !== 'DISCONNECTED') {
          this.updateState('ERROR', 'Bluetooth adapter powered off.', 'BLE_DISABLED');
        }
      });

      this.noble.on('discover', (peripheral: any) => {
        this.handleDiscoveredPeripheral(peripheral);
      });
    } catch (err: any) {
      logger.warn(`[BLE-MAC] Could not initialize noble CoreBluetooth binding: ${err.message}`);
    }
  }

  setStatusCallback(callback: (status: VeerBleStatus) => void) {
    this.statusChangeCallback = callback;
  }

  getStatus(): VeerBleStatus {
    return {
      state: this.currentState,
      deviceId: this.currentDeviceId,
      deviceName: this.currentDeviceName,
      serviceUuid: this.currentServiceUuid,
      characteristicUuid: this.currentCharacteristicUuid,
      mtu: this.currentMtu,
      errorMessage: this.lastErrorMessage,
      errorCode: this.lastErrorCode,
      lastPrintSuccess: this.lastPrintSuccess,
    };
  }

  private updateState(state: VeerBleConnectionState, errorMsg: string | null = null, errorCode: VeerBleErrorCode | null = null) {
    this.currentState = state;
    this.lastErrorMessage = errorMsg;
    this.lastErrorCode = errorCode;
    logger.info(`[BLE-MAC] State Transition -> [${state}]${errorMsg ? ` (${errorMsg})` : ''}`);

    if (this.statusChangeCallback) {
      this.statusChangeCallback(this.getStatus());
    }
  }

  async scan(timeoutMs = 6000): Promise<{ success: boolean; devices: VeerBleDevice[]; message: string }> {
    logger.info('[BLE-MAC] Scanning macOS CoreBluetooth for VEER devices...');
    this.discoveredDevices.clear();
    this.updateState('SCANNING');

    if (!this.noble) {
      this.updateState('ERROR', 'macOS BLE driver unavailable.', 'BLE_DISABLED');
      return { success: false, devices: [], message: 'BLE driver unavailable.' };
    }

    if (this.noble.state === 'unauthorized') {
      this.updateState('ERROR', 'macOS Bluetooth permission denied. Please enable Bluetooth in System Preferences > Privacy & Security.', 'BLE_PERMISSION_DENIED');
      return { success: false, devices: [], message: 'macOS Bluetooth permission denied.' };
    }

    if (this.noble.state !== 'poweredOn') {
      this.updateState('ERROR', `macOS Bluetooth state is '${this.noble.state}'.`, 'BLE_DISABLED');
      return { success: false, devices: [], message: `Bluetooth is ${this.noble.state}.` };
    }

    return new Promise((resolve) => {
      try {
        this.noble.startScanning([], true, (err: any) => {
          if (err) {
            this.updateState('ERROR', err.message, 'BLE_PERMISSION_DENIED');
            resolve({ success: false, devices: [], message: err.message });
            return;
          }

          setTimeout(() => {
            try { this.noble.stopScanning(); } catch (e) {}
            const deviceList = Array.from(this.discoveredDevices.values());
            const veerDevices = deviceList.filter(d => d.isVeer);

            if (veerDevices.length > 0) {
              this.updateState('VEER_FOUND');
            } else {
              this.updateState('DISCONNECTED', 'No verified VEER BLE printer found.', 'VEER_NOT_FOUND');
            }

            logger.info(`[BLE-MAC] Scan completed. Discovered ${deviceList.length} total, ${veerDevices.length} VEER device(s).`);
            resolve({
              success: true,
              devices: deviceList,
              message: `Discovered ${deviceList.length} device(s), ${veerDevices.length} VEER printer(s).`,
            });
          }, timeoutMs);
        });
      } catch (e: any) {
        this.updateState('ERROR', e.message, 'BLE_DISABLED');
        resolve({ success: false, devices: [], message: e.message });
      }
    });
  }

  private handleDiscoveredPeripheral(peripheral: any) {
    const name = (peripheral.advertisement?.localName || peripheral.name || '').trim();
    const id = peripheral.id || peripheral.uuid || '';
    const uuids = (peripheral.advertisement?.serviceUuids || []).map((u: string) => u.toLowerCase());
    const mfgDataHex = peripheral.advertisement?.manufacturerData?.toString('hex') || '';

    const isVeer = this.verifyVeerIdentity(name, uuids, mfgDataHex);

    const dev: VeerBleDevice = {
      id,
      name: name || `VEER Printer (${id.slice(-6)})`,
      address: peripheral.address || id,
      rssi: peripheral.rssi,
      serviceUuids: uuids,
      manufacturerData: mfgDataHex,
      isVeer,
    };

    this.discoveredDevices.set(id, dev);

    if (isVeer) {
      logger.info(`[BLE-MAC] Verified VEER Device Discovered -> "${dev.name}" [UUID: ${dev.id}]`);
    }
  }

  private verifyVeerIdentity(name: string, serviceUuids: string[], mfgData: string): boolean {
    const lowerName = name.toLowerCase();
    const nameMatch = 
      lowerName.includes('veer') || 
      lowerName.includes('pos58') || 
      lowerName.includes('pos-58') || 
      lowerName.includes('prt80') || 
      lowerName.includes('olivetti') || 
      lowerName.startsWith('58mm');

    const uuidMatch = serviceUuids.some(uuid => 
      SDK_VEER_SERVICE_UUIDS.some(sdkUuid => uuid.replace(/-/g, '').includes(sdkUuid.replace(/-/g, '')))
    );

    const mfgMatch = mfgData.toLowerCase().includes('0483') || mfgData.toLowerCase().includes('5840');
    return nameMatch || uuidMatch || mfgMatch;
  }

  async connect(targetDeviceId: string): Promise<{ success: boolean; status: VeerBleStatus; message: string }> {
    logger.info(`[BLE-MAC] Connecting macOS CoreBluetooth GATT to device: "${targetDeviceId}"...`);

    const targetDev = this.discoveredDevices.get(targetDeviceId);
    if (targetDev && !targetDev.isVeer) {
      this.updateState('ERROR', `Device "${targetDev.name}" is not a verified VEER printer.`, 'VEER_IDENTITY_MISMATCH');
      return { success: false, status: this.getStatus(), message: 'VEER identity mismatch.' };
    }

    this.updateState('CONNECTING');

    if (!this.noble) {
      this.updateState('ERROR', 'Noble BLE driver unavailable.', 'BLE_DISABLED');
      return { success: false, status: this.getStatus(), message: 'BLE driver unavailable.' };
    }

    return new Promise((resolve) => {
      const peripheral = this.noble._peripherals[targetDeviceId] || this.activePeripheral;
      
      if (!peripheral) {
        this.updateState('ERROR', `Peripheral "${targetDeviceId}" not found.`, 'VEER_NOT_FOUND');
        resolve({ success: false, status: this.getStatus(), message: 'Device not found.' });
        return;
      }

      this.activePeripheral = peripheral;
      this.currentDeviceId = targetDeviceId;
      this.currentDeviceName = peripheral.advertisement?.localName || peripheral.name || 'VEER POS58 Printer';

      this.activePeripheral.connect((err: any) => {
        if (err) {
          this.updateState('ERROR', `GATT connection error: ${err.message}`, 'BLE_CONNECTION_FAILED');
          resolve({ success: false, status: this.getStatus(), message: err.message });
          return;
        }

        this.updateState('CONNECTED');
        this.updateState('DISCOVERING_SERVICES');

        this.activePeripheral.discoverServices([], (sErr: any, services: any[]) => {
          if (sErr || !services || services.length === 0) {
            this.updateState('ERROR', 'Service discovery failed.', 'BLE_SERVICE_NOT_FOUND');
            resolve({ success: false, status: this.getStatus(), message: 'Service discovery failed.' });
            return;
          }

          const matchedService = services.find((s: any) => {
            const suuid = String(s.uuid || '').toLowerCase().replace(/-/g, '');
            return SDK_VEER_SERVICE_UUIDS.some(sdkUuid => suuid.includes(sdkUuid.replace(/-/g, '')));
          }) || services[0];

          this.currentServiceUuid = matchedService.uuid;
          this.updateState('SERVICE_FOUND');

          matchedService.discoverCharacteristics([], (cErr: any, characteristics: any[]) => {
            if (cErr || !characteristics || characteristics.length === 0) {
              this.updateState('ERROR', 'Characteristic discovery failed.', 'BLE_CHARACTERISTIC_NOT_FOUND');
              resolve({ success: false, status: this.getStatus(), message: 'Characteristic discovery failed.' });
              return;
            }

            const matchedChar = characteristics.find((c: any) => {
              const cuuid = String(c.uuid || '').toLowerCase().replace(/-/g, '');
              const isSdkUuid = SDK_VEER_CHARACTERISTIC_UUIDS.some(sdkUuid => cuuid.includes(sdkUuid.replace(/-/g, '')));
              return isSdkUuid && (c.properties.includes('write') || c.properties.includes('writeWithoutResponse'));
            }) || characteristics.find((c: any) => c.properties.includes('write') || c.properties.includes('writeWithoutResponse'));

            if (!matchedChar) {
              this.updateState('ERROR', 'No writable GATT characteristic found.', 'BLE_CHARACTERISTIC_NOT_WRITABLE');
              resolve({ success: false, status: this.getStatus(), message: 'No writable characteristic found.' });
              return;
            }

            this.writeCharacteristic = matchedChar;
            this.currentCharacteristicUuid = matchedChar.uuid;
            this.currentMtu = 180;

            this.updateState('CHARACTERISTIC_FOUND');
            this.updateState('READY');

            logger.info(`[BLE-MAC] BLE GATT SETUP READY ✓ | Service: "${matchedService.uuid}" | Characteristic: "${matchedChar.uuid}"`);

            resolve({
              success: true,
              status: this.getStatus(),
              message: `CoreBluetooth GATT Connection READY. Connected to "${this.currentDeviceName}".`,
            });
          });
        });
      });
    });
  }

  async disconnect(): Promise<{ success: boolean; message: string }> {
    if (this.activePeripheral) {
      try { this.activePeripheral.disconnect(); } catch (e) {}
    }
    this.activePeripheral = null;
    this.writeCharacteristic = null;
    this.currentDeviceId = null;
    this.currentDeviceName = null;
    this.updateState('DISCONNECTED');
    return { success: true, message: 'macOS BLE disconnected.' };
  }

  async testPrint(): Promise<VeerBlePrintResult> {
    const testReceiptBuffer = VeerReceiptCommandGenerator.createTestReceipt();
    return this.writeReceiptBuffer(testReceiptBuffer, 'BLE Test Receipt');
  }

  async writeReceiptBuffer(buffer: Buffer, jobLabel = 'BLE Print Job'): Promise<VeerBlePrintResult> {
    logger.info(`[BLE-MAC] Transmitting BLE receipt (${buffer.length} bytes) for "${jobLabel}"...`);

    if (this.currentState !== 'READY' && this.currentState !== 'CONNECTED') {
      return {
        success: false,
        state: this.currentState,
        errorCode: 'BLE_DISCONNECTED',
        message: `Printer not connected (current state: ${this.currentState}).`,
      };
    }

    if (!this.writeCharacteristic) {
      return {
        success: false,
        state: 'ERROR',
        errorCode: 'BLE_CHARACTERISTIC_NOT_WRITABLE',
        message: 'Writable characteristic unavailable.',
      };
    }

    this.updateState('PRINTING');

    const chunkSize = 120;
    const totalChunks = Math.ceil(buffer.length / chunkSize);
    const properties = this.writeCharacteristic.properties || [];
    const writeWithoutResponse = properties.includes('writeWithoutResponse');

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, buffer.length);
        const chunk = buffer.slice(start, end);

        logger.info(`[PRINT] Writing macOS BLE chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)...`);

        await new Promise<void>((resolveChunk, rejectChunk) => {
          this.writeCharacteristic.write(chunk, writeWithoutResponse, (wErr: any) => {
            if (wErr) {
              rejectChunk(new Error(`Chunk ${i + 1} write error: ${wErr.message}`));
            } else {
              resolveChunk();
            }
          });
        });

        await new Promise(r => setTimeout(r, 15));
      }

      this.lastPrintSuccess = true;
      this.updateState('PRINT_SUCCESS');
      this.updateState('READY');

      logger.info(`[PRINT] macOS BLE print complete for "${jobLabel}" ✓`);

      return {
        success: true,
        state: 'PRINT_SUCCESS',
        message: `Print data (${jobLabel}) transmitted via CoreBluetooth GATT (${buffer.length} bytes in ${totalChunks} chunks).`,
        bytesSent: buffer.length,
        chunksSent: totalChunks,
      };
    } catch (err: any) {
      logger.error(`[PRINT ERROR] macOS BLE write failed: ${err.message}`);
      this.lastPrintSuccess = false;
      this.updateState('ERROR', err.message, 'BLE_WRITE_FAILED');

      return {
        success: false,
        state: 'ERROR',
        errorCode: 'BLE_WRITE_FAILED',
        message: `BLE write failed: ${err.message}`,
        details: err.message,
      };
    }
  }
}
