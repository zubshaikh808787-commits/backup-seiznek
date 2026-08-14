import { create } from 'zustand';
import { VeerBleDevice, VeerBleStatus, VeerBlePrintResult } from '../../../shared/types';

interface VeerBleState {
  status: VeerBleStatus;
  scannedDevices: VeerBleDevice[];
  isScanning: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  lastPrintResult: VeerBlePrintResult | null;
  statusMessage: string;

  scanBle: () => Promise<void>;
  connectBle: (deviceId: string) => Promise<void>;
  disconnectBle: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  testPrintBle: () => Promise<VeerBlePrintResult>;
  printBle: (data?: string) => Promise<VeerBlePrintResult>;
  subscribeToUpdates: () => void;
}

const initialStatus: VeerBleStatus = {
  state: 'DISCONNECTED',
  deviceId: null,
  deviceName: null,
  serviceUuid: null,
  characteristicUuid: null,
  mtu: 20,
  errorMessage: null,
  errorCode: null,
  lastPrintSuccess: false,
};

export const useVeerBleStore = create<VeerBleState>((set, get) => ({
  status: initialStatus,
  scannedDevices: [],
  isScanning: false,
  isConnecting: false,
  isPrinting: false,
  lastPrintResult: null,
  statusMessage: 'Ready for VEER Bluetooth Setup.',

  subscribeToUpdates: () => {
    if (window.veerBle?.onBleStatusChanged) {
      window.veerBle.onBleStatusChanged((status) => {
        set({ 
          status, 
          isConnecting: status.state === 'CONNECTING' || status.state === 'DISCOVERING_SERVICES',
          isPrinting: status.state === 'PRINTING',
        });
      });
    }
  },

  scanBle: async () => {
    set({ isScanning: true, statusMessage: 'Scanning for VEER Bluetooth devices...' });
    try {
      if (window.veerBle) {
        const res = await window.veerBle.scan();
        set({ 
          scannedDevices: res.devices || [], 
          isScanning: false, 
          statusMessage: res.message 
        });
      } else {
        set({ isScanning: false, statusMessage: 'VEER BLE API unavailable in renderer.' });
      }
    } catch (err: any) {
      set({ isScanning: false, statusMessage: `Scan error: ${err.message}` });
    }
  },

  connectBle: async (deviceId: string) => {
    set({ isConnecting: true, statusMessage: `Connecting to BLE printer [${deviceId}]...` });
    try {
      if (window.veerBle) {
        const res = await window.veerBle.connect(deviceId);
        set({ 
          status: res.status, 
          isConnecting: false, 
          statusMessage: res.message 
        });
      }
    } catch (err: any) {
      set({ isConnecting: false, statusMessage: `Connection failed: ${err.message}` });
    }
  },

  disconnectBle: async () => {
    try {
      if (window.veerBle) {
        const res = await window.veerBle.disconnect();
        set({ status: { ...initialStatus, state: 'DISCONNECTED' }, statusMessage: res.message });
      }
    } catch (err: any) {
      set({ statusMessage: `Disconnect error: ${err.message}` });
    }
  },

  fetchStatus: async () => {
    try {
      if (window.veerBle) {
        const st = await window.veerBle.status();
        set({ status: st });
      }
    } catch (e) {}
  },

  testPrintBle: async () => {
    set({ isPrinting: true, statusMessage: 'Generating & sending real BLE test receipt...' });
    try {
      if (window.veerBle) {
        const res = await window.veerBle.testPrint();
        set({ 
          lastPrintResult: res, 
          isPrinting: false, 
          statusMessage: res.message 
        });
        return res;
      }
      const fail: VeerBlePrintResult = {
        success: false,
        state: 'ERROR',
        errorCode: 'BLE_DISABLED',
        message: 'BLE API unattached.',
      };
      set({ isPrinting: false, lastPrintResult: fail });
      return fail;
    } catch (err: any) {
      const fail: VeerBlePrintResult = {
        success: false,
        state: 'ERROR',
        errorCode: 'PRINT_FAILED',
        message: err.message,
      };
      set({ isPrinting: false, lastPrintResult: fail });
      return fail;
    }
  },

  printBle: async (data?: string) => {
    set({ isPrinting: true, statusMessage: 'Transmitting receipt data over BLE GATT...' });
    try {
      if (window.veerBle) {
        const res = await window.veerBle.print(data);
        set({ 
          lastPrintResult: res, 
          isPrinting: false, 
          statusMessage: res.message 
        });
        return res;
      }
      const fail: VeerBlePrintResult = {
        success: false,
        state: 'ERROR',
        errorCode: 'BLE_DISABLED',
        message: 'BLE API unattached.',
      };
      set({ isPrinting: false, lastPrintResult: fail });
      return fail;
    } catch (err: any) {
      const fail: VeerBlePrintResult = {
        success: false,
        state: 'ERROR',
        errorCode: 'PRINT_FAILED',
        message: err.message,
      };
      set({ isPrinting: false, lastPrintResult: fail });
      return fail;
    }
  },
}));
