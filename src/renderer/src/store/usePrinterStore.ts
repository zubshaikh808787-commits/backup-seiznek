import { create } from 'zustand';
import {
  PrinterDevice,
  OSPrinterInfo,
  UnspecifiedDevice,
  ConnectionType,
  SavedPrinter,
  V1OrchestratorState,
  JoshTestPrintResult,
  BluetoothConnectionState,
} from '@shared/types';

interface PrinterStoreState {
  // Real V1 Main Process Orchestrator State
  v1State: V1OrchestratorState;
  lastDiagnosticResult: JoshTestPrintResult | null;
  
  activePrinter: PrinterDevice | null;
  printers: PrinterDevice[];
  osPrinters: OSPrinterInfo[];
  savedPrinters: SavedPrinter[];
  defaultPrinterId: string | null;
  toastMessage: string | null;
  unspecifiedDevices: UnspecifiedDevice[];
  connectionType: ConnectionType;
  isScanning: boolean;

  // Saved Printer Operations
  fetchSavedPrinters: () => Promise<void>;
  savePrinter: (printer: Partial<SavedPrinter>) => Promise<{ success: boolean; message: string }>;
  removeSavedPrinter: (printerId: string) => Promise<{ success: boolean; message: string }>;
  clearSavedPrinters: () => Promise<{ success: boolean; message: string }>;
  setSavedDefaultPrinter: (printerId: string) => Promise<{ success: boolean; message: string }>;
  removeSavedDefaultPrinter: () => Promise<{ success: boolean; message: string }>;

  // State Updates
  setIsScanning: (scanning: boolean) => void;
  setToastMessage: (msg: string | null) => void;

  // DothanTech DtpWeb Official SDK State
  dtpWebRunning: boolean;
  dtpWebMessage: string;
  dtpWebPrinters: any[];
  checkDtpWebPlugin: () => Promise<boolean>;
  fetchDtpWebPrinters: () => Promise<void>;
  printDtpWebLabel: (printerName?: string) => Promise<{ success: boolean; message: string; reason?: string }>;

  // V1 Automated Actions
  initV1Orchestrator: () => Promise<void>;
  startV1Pipeline: () => Promise<void>;
  resetAndScanV1: () => Promise<void>;
  triggerV1TestPrint: () => Promise<JoshTestPrintResult>;

  // Bluetooth (BLE/SPP) Printer Pairing — optional, after USB setup completes
  bluetoothState: BluetoothConnectionState;
  initBluetooth: () => Promise<void>;
  scanBluetoothDevices: () => Promise<void>;
  connectBluetoothDevice: (deviceId: string) => Promise<void>;
  triggerBluetoothTestPrint: () => Promise<void>;
  disconnectBluetoothDevice: () => Promise<void>;
  forgetBluetoothDevice: (deviceId: string) => Promise<void>;

  fetchOsPrinters: () => Promise<void>;
  fetchUnspecifiedDevices: () => Promise<void>;
  installJoshDriver: () => Promise<{ success: boolean; log: string }>;
  installVeerDriver: () => Promise<{ success: boolean; log: string }>;
  installDevDriver: () => Promise<{ success: boolean; log: string }>;
  uninstallDriver: (printerName: string) => Promise<{ success: boolean; log: string }>;
  setDefaultPrinter: (printerName: string) => Promise<{ success: boolean; message: string }>;
  triggerTestPrint: (type: 'RECEIPT' | 'LABEL') => Promise<JoshTestPrintResult>;
  calibratePrinter: (printerName: string) => Promise<{ success: boolean; message: string }>;
}

export const usePrinterStore = create<PrinterStoreState>((set, get) => ({
  v1State: {
    step: 'NO_USB_CONNECTED',
    stepMessage: 'No USB printer detected.',
    progressPercent: 0,
    usbConnected: false,
    detectedHardwareName: '',
    vendorId: null,
    productId: null,
    brand: 'UNSUPPORTED',
    driverInstalled: false,
    queueName: null,
    savedPrinterId: null,
    isDefault: false,
    testPrintSuccess: false,
  },
  lastDiagnosticResult: null,

  bluetoothState: {
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
  },

  activePrinter: null,
  printers: [],
  osPrinters: [],
  savedPrinters: [],
  defaultPrinterId: null,
  toastMessage: null,
  unspecifiedDevices: [],
  connectionType: 'USB',
  isScanning: false,

  dtpWebRunning: false,
  dtpWebMessage: 'Checking DtpWeb Assistant...',
  dtpWebPrinters: [],

  setIsScanning: (scanning) => set({ isScanning: scanning }),
  setToastMessage: (msg) => set({ toastMessage: msg }),

  initV1Orchestrator: async () => {
    if (window.seznikApi) {
      const state = await window.seznikApi.getV1State();
      set({ v1State: state });

      window.seznikApi.onV1StateChanged((newState) => {
        set({ v1State: newState });
        get().fetchOsPrinters();
        get().fetchSavedPrinters();
      });
    }
  },

  startV1Pipeline: async () => {
    if (window.seznikApi) {
      const state = await window.seznikApi.startV1Setup();
      set({ v1State: state });
    }
  },

  triggerV1TestPrint: async () => {
    if (window.seznikApi) {
      const res = await window.seznikApi.triggerManualV1TestPrint();
      set({ lastDiagnosticResult: res });
      return res;
    }
    const fallback: JoshTestPrintResult = {
      success: false,
      stage: 'USB_DETECTION',
      code: 'API_UNAVAILABLE',
      printerName: 'USB Printer',
      queueName: 'None',
      message: 'Electron API unavailable',
    };
    set({ lastDiagnosticResult: fallback });
    return fallback;
  },

  initBluetooth: async () => {
    if (window.seznikApi) {
      const state = await window.seznikApi.getBluetoothState();
      set({ bluetoothState: state });

      window.seznikApi.onBluetoothStateChanged((newState) => {
        const wasConnected = !!get().bluetoothState.connectedComPort;
        set({ bluetoothState: newState });
        if (newState.step === 'TEST_PRINT_SUCCESS') {
          get().fetchSavedPrinters();
        }
        // Surface an unexpected hardware drop even if the Bluetooth modal isn't open.
        if (wasConnected && !newState.connectedComPort && newState.step === 'ERROR') {
          set({ toastMessage: newState.stepMessage });
          setTimeout(() => set({ toastMessage: null }), 6000);
        }
      });
    }
  },

  scanBluetoothDevices: async () => {
    if (window.seznikApi) {
      const state = await window.seznikApi.scanBluetoothDevices();
      set({ bluetoothState: state });
    }
  },

  connectBluetoothDevice: async (deviceId: string) => {
    if (window.seznikApi) {
      const state = await window.seznikApi.connectBluetoothDevice(deviceId);
      set({ bluetoothState: state });
    }
  },

  triggerBluetoothTestPrint: async () => {
    if (window.seznikApi) {
      const state = await window.seznikApi.triggerBluetoothTestPrint();
      set({ bluetoothState: state });
    }
  },

  disconnectBluetoothDevice: async () => {
    if (window.seznikApi) {
      const state = await window.seznikApi.disconnectBluetoothDevice();
      set({ bluetoothState: state });
    }
  },

  forgetBluetoothDevice: async (deviceId: string) => {
    if (window.seznikApi) {
      const state = await window.seznikApi.forgetBluetoothDevice(deviceId);
      set({ bluetoothState: state });
      await get().fetchSavedPrinters();
    }
  },

  fetchSavedPrinters: async () => {
    if (window.seznikApi) {
      const saved = await window.seznikApi.getSavedPrinters();
      const defPrinter = saved.find(p => p.isDefault);
      set({ 
        savedPrinters: saved || [],
        defaultPrinterId: defPrinter ? defPrinter.id : (saved.length > 0 ? saved[0].id : null)
      });
    }
  },

  savePrinter: async (printer) => {
    if (window.seznikApi) {
      const res = await window.seznikApi.savePrinter(printer);
      const defPrinter = res.savedPrinters.find(p => p.isDefault);
      set({ 
        savedPrinters: res.savedPrinters,
        defaultPrinterId: defPrinter ? defPrinter.id : null,
        toastMessage: res.message,
      });
      setTimeout(() => set({ toastMessage: null }), 4000);
      return { success: true, message: res.message };
    }
    return { success: false, message: 'API unavailable' };
  },

  removeSavedPrinter: async (printerId) => {
    if (window.seznikApi) {
      const res = await window.seznikApi.removeSavedPrinter(printerId);
      if (res.success) {
        set({ 
          savedPrinters: res.savedPrinters,
          defaultPrinterId: res.defaultPrinterId,
          toastMessage: res.message,
        });
        setTimeout(() => set({ toastMessage: null }), 4000);
        return { success: true, message: res.message };
      }
      set({ toastMessage: res.message });
      setTimeout(() => set({ toastMessage: null }), 4000);
      return { success: false, message: res.message };
    }
    return { success: false, message: 'Unable to remove printer.' };
  },

  clearSavedPrinters: async () => {
    if (window.seznikApi) {
      const res = await window.seznikApi.clearSavedPrinters();
      set({
        savedPrinters: [],
        defaultPrinterId: null,
        toastMessage: res.message,
      });
      setTimeout(() => set({ toastMessage: null }), 4000);
      return { success: true, message: res.message };
    }
    return { success: false, message: 'Unable to clear printers.' };
  },

  setSavedDefaultPrinter: async (printerId) => {
    if (window.seznikApi) {
      const res = await window.seznikApi.setSavedDefaultPrinter(printerId);
      if (res.success) {
        set({ 
          savedPrinters: res.savedPrinters,
          defaultPrinterId: res.defaultPrinterId,
          toastMessage: res.message,
        });
        await get().fetchOsPrinters();
        setTimeout(() => set({ toastMessage: null }), 4000);
        return { success: true, message: res.message };
      }
    }
    return { success: false, message: 'Unable to set default printer.' };
  },

  removeSavedDefaultPrinter: async () => {
    if (window.seznikApi) {
      const res = await window.seznikApi.removeSavedDefaultPrinter();
      set({
        savedPrinters: res.savedPrinters,
        defaultPrinterId: res.defaultPrinterId || null,
        toastMessage: res.message,
      });
      await get().fetchOsPrinters();
      setTimeout(() => set({ toastMessage: null }), 4000);
      return { success: true, message: res.message };
    }
    return { success: false, message: 'Unable to remove default printer.' };
  },

  resetAndScanV1: async () => {
    if (window.seznikApi) {
      set({ toastMessage: 'Resetting hardware state & scanning for new device...' });
      const state = await window.seznikApi.resetAndScanV1();
      set({ v1State: state });
      setTimeout(() => set({ toastMessage: null }), 4000);
    }
  },

  checkDtpWebPlugin: async () => {
    if (window.seznikApi) {
      const res = await window.seznikApi.checkDtpWebPlugin();
      set({ dtpWebRunning: res.running, dtpWebMessage: res.message });
      if (res.running) {
        get().fetchDtpWebPrinters();
      }
      return res.running;
    }
    return false;
  },

  fetchDtpWebPrinters: async () => {
    if (window.seznikApi) {
      const res = await window.seznikApi.getDtpWebPrinters();
      if (res.success) {
        set({ dtpWebPrinters: res.printers, dtpWebMessage: res.message });
      } else {
        set({ dtpWebPrinters: [], dtpWebMessage: res.message });
      }
    }
  },

  printDtpWebLabel: async (printerName?: string) => {
    if (window.seznikApi) {
      return await window.seznikApi.printDtpWebLabel(printerName);
    }
    return { success: false, message: 'Electron API unavailable.' };
  },

  fetchOsPrinters: async () => {
    if (window.seznikApi) {
      const osPrinters = await window.seznikApi.getOsPrinters();
      set({ osPrinters: osPrinters || [] });
    }
  },

  fetchUnspecifiedDevices: async () => {
    if (window.seznikApi) {
      const unspecifiedDevices = await window.seznikApi.getUnspecifiedDevices();
      set({ unspecifiedDevices: unspecifiedDevices || [] });
    }
  },

  installJoshDriver: async () => {
    if (window.seznikApi) {
      return await window.seznikApi.installJoshDriver();
    }
    return { success: false, log: 'Electron API unavailable.' };
  },

  installVeerDriver: async () => {
    if (window.seznikApi) {
      return await window.seznikApi.installVeerDriver();
    }
    return { success: false, log: 'Electron API unavailable.' };
  },

  installDevDriver: async () => {
    if (window.seznikApi) {
      return await window.seznikApi.installDevDriver();
    }
    return { success: false, log: 'Electron API unavailable.' };
  },

  uninstallDriver: async (printerName: string) => {
    if (window.seznikApi) {
      const res = await window.seznikApi.uninstallDriver(printerName);
      await get().fetchOsPrinters();
      await get().fetchSavedPrinters();
      return res;
    }
    return { success: false, log: 'Electron API unavailable.' };
  },

  setDefaultPrinter: async (printerName: string) => {
    if (window.seznikApi) {
      const res = await window.seznikApi.setDefaultPrinter(printerName);
      await get().fetchOsPrinters();
      // Automatically give a physical test print of the barcode label upon setting default
      await window.seznikApi.triggerManualV1TestPrint();
      return res;
    }
    return { success: false, message: 'Electron API unavailable.' };
  },

  triggerTestPrint: async (type) => {
    const targetName = get().v1State.queueName || get().savedPrinters[0]?.name;
    if (!targetName) {
      const fallback: JoshTestPrintResult = {
        success: false,
        stage: 'USB_DETECTION',
        code: 'NO_PRINTER',
        printerName: 'USB Printer',
        queueName: 'None',
        message: 'No connected USB printer found to test.',
      };
      set({ lastDiagnosticResult: fallback });
      return fallback;
    }
    if (window.seznikApi) {
      const res = await window.seznikApi.printRawEscPos(targetName, type);
      set({ lastDiagnosticResult: res });
      return res;
    }
    const fallback: JoshTestPrintResult = {
      success: false,
      stage: 'USB_DETECTION',
      code: 'API_UNAVAILABLE',
      printerName: targetName,
      queueName: targetName,
      message: 'Electron API unavailable.',
    };
    set({ lastDiagnosticResult: fallback });
    return fallback;
  },

  calibratePrinter: async (printerName) => {
    if (window.seznikApi) {
      return await window.seznikApi.calibratePrinter(printerName);
    }
    return { success: false, message: 'Electron API unavailable.' };
  },
}));
