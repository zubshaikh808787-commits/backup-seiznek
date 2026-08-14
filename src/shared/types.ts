// Shared Application & Hardware Types for SEZNIK Printer Manager (Final V1 Architecture)

export type ConnectionType = 'USB' | 'BLUETOOTH';

export type PrinterType =
  | 'RECEIPT'
  | 'LABEL'
  | 'RECEIPT_AND_LABEL'
  | 'USB_STANDARD';

export type PrinterStatus = 'DISCONNECTED' | 'SEARCHING' | 'CONNECTED' | 'READY' | 'ERROR';
export type DeviceHealth = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface DeviceIdentification {
  vendorId: string;
  productId: string;
  modelNumber: string;
  manufacturer?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  paperWidthMm: number;
  printerLanguage: string;
  supportsDualMode: boolean;
}

export interface OSPrinterInfo {
  name: string;
  driverName: string;
  portName: string;
  status: string;
  isDefault: boolean;
  isShared: boolean;
}

export interface SavedPrinter {
  id: string;
  name: string;
  driverName: string;
  portName: string;
  connectionType: ConnectionType;
  isDefault: boolean;
  printerType: PrinterType;
  savedAt: string;
  macAddress?: string | null;
}

export interface RemoveSavedPrinterResult {
  success: boolean;
  removedPrinterId?: string;
  defaultPrinterId: string | null;
  savedPrinters: SavedPrinter[];
  message: string;
  error?: string;
}

export interface SetSavedDefaultResult {
  success: boolean;
  defaultPrinterId: string | null;
  savedPrinters: SavedPrinter[];
  message: string;
}

export interface UnspecifiedDevice {
  name: string;
  caption: string;
  pnpClass: string;
  status: string;
  needsDriver: boolean;
}

export interface PrinterDevice {
  id: string;
  name: string;
  modelNumber: string;
  serialNumber?: string;
  connectionType: ConnectionType;
  vendorId?: string;
  productId?: string;
  portName?: string;
  printerType: PrinterType;
  paperWidthMm: number;
  printerLanguage: string;
  isDualMode: boolean;
  
  installedDriverVersion?: string;
  installedFirmwareVersion?: string;
  installedSdkVersion?: string;
  
  status: PrinterStatus;
  healthStatus: DeviceHealth;
  
  createdAt: string;
  updatedAt: string;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  actionType: string;
  message: string;
  details?: string;
  errorCode?: string;
}

export interface SystemSettings {
  theme: 'dark' | 'light' | 'system';
  language: 'en' | 'es' | 'fr' | 'de';
  autoUpdate: boolean;
  logLevel: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  downloadPath: string;
}

export type V1PrinterProfileBrand = 'JOSH' | 'VEER' | 'DEV' | 'UNSUPPORTED';

export type DetailedPrinterStatus = 
  | 'DISCOVERING'
  | 'FOUND'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'PRINTER_READY'
  | 'CONNECTION_FAILED'
  | 'DRIVER_NOT_FOUND'
  | 'SDK_NOT_FOUND'
  | 'PRINTER_NOT_READY'
  | 'PRINTING'
  | 'PRINT_SUCCESS'
  | 'PRINT_FAILED'
  | 'DISCONNECTED'
  | 'UNSUPPORTED_PRINTER';

export interface PrinterProfile {
  brand: V1PrinterProfileBrand;
  type: 'LABEL' | 'RECEIPT' | 'RECEIPT_AND_LABEL' | 'UNSUPPORTED';
  documentType: 'LABEL' | 'RECEIPT' | 'BOTH' | 'NONE';
  paperWidthMm: number;
  paperHeightMm: number | null;
  pipeline: 'JOSH' | 'VEER' | 'DEV' | 'UNSUPPORTED';
}

export const JOSH_PROFILE: PrinterProfile = {
  brand: 'JOSH',
  type: 'LABEL',
  documentType: 'LABEL',
  paperWidthMm: 50,
  paperHeightMm: 50,
  pipeline: 'JOSH',
};

export const VEER_PROFILE: PrinterProfile = {
  brand: 'VEER',
  type: 'RECEIPT',
  documentType: 'RECEIPT',
  paperWidthMm: 58,
  paperHeightMm: null,
  pipeline: 'VEER',
};

export const DEV_PROFILE: PrinterProfile = {
  brand: 'DEV',
  type: 'RECEIPT_AND_LABEL',
  documentType: 'BOTH',
  paperWidthMm: 80,
  paperHeightMm: 50,
  pipeline: 'DEV',
};

export type V1SetupStep =
  | 'NO_USB_CONNECTED'
  | 'USB_DETECTED'
  | 'IDENTIFYING'
  | 'PROFILE_MATCHED'
  | 'CHECKING_DRIVER'
  | 'INSTALLING_DRIVER'
  | 'DRIVER_VERIFIED'
  | 'CONFIGURING_PRINTER'
  | 'TEST_PRINTING'
  | 'PRINT_VERIFIED'
  | 'SAVING_PRINTER'
  | 'SETTING_DEFAULT'
  | 'SETUP_COMPLETE'
  | 'UNSUPPORTED_PRINTER'
  | 'ERROR';

export interface V1OrchestratorState {
  step: V1SetupStep;
  stepMessage: string;
  progressPercent: number;
  usbConnected: boolean;
  detectedHardwareName: string;
  vendorId: string | null;
  productId: string | null;
  brand: V1PrinterProfileBrand;
  driverInstalled: boolean;
  queueName: string | null;
  savedPrinterId: string | null;
  isDefault: boolean;
  testPrintSuccess: boolean;
  errorDetails?: string;
}

export type TestPrintStage =
  | 'USB_DETECTION'
  | 'HARDWARE_IDENTIFICATION'
  | 'DRIVER_VERIFICATION'
  | 'QUEUE_VERIFICATION'
  | 'PRINTER_STATUS'
  | 'SPOOLER_STATUS'
  | 'PRINT_DATA_GENERATION'
  | 'PRINT_SUBMISSION'
  | 'JOB_ACCEPTED'
  | 'JOB_MONITORING'
  | 'JOB_COMPLETED'
  | 'PHYSICAL_PRINT_VERIFICATION';

export interface DetectedPrinter {
  printerId: string;
  brand: V1PrinterProfileBrand;
  name: string;
  queueName: string;
  portName?: string;
  driverName?: string;
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  isReady: boolean;
  platform: 'win32' | 'darwin' | string;
}

export interface PrintResult {
  success: boolean;
  printerId: string;
  platform: 'win32' | 'darwin' | string;
  queueName?: string;
  portName?: string;
  bytesSent?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface JoshTestPrintResult {
  success: boolean;
  stage: TestPrintStage;
  code?: string;
  printerName: string;
  brand?: string;
  driverName?: string;
  queueName: string;
  jobId?: number | string | null;
  spoolerStatus?: string;
  printerStatus?: string;
  message: string;
  details?: string;
  suggestedAction?: string;
}

// ============================================================
// Bluetooth (BLE / SPP) Printer Connection — Post-USB-Setup Pairing
// ============================================================
// Flow: user completes USB driver setup first (V1 pipeline above). Once
// SETUP_COMPLETE, they may optionally pair the same/another printer over
// Bluetooth. The printer pairs in Windows Bluetooth settings and exposes a
// "Standard Serial over Bluetooth link (COMx)" port (SPP profile) — we
// discover that paired device + its COM port, connect to it, and fire one
// automatic test receipt to confirm the link works.

export interface BluetoothPairedDevice {
  id: string; // stable id: mac address if known, else derived from instanceId
  name: string;
  address: string | null; // 12-hex Bluetooth MAC, uppercase, no separators
  comPort: string | null; // e.g. "COM5" — null if Windows hasn't bound an SPP port yet
  isLikelyPrinter: boolean; // heuristic keyword match (pos/receipt/veer/printer/thermal/bt)
}

export type BluetoothConnectionStep =
  | 'IDLE'
  | 'SCANNING'
  | 'DEVICES_FOUND'
  | 'NO_DEVICES_FOUND'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'TEST_PRINTING'
  | 'TEST_PRINT_SUCCESS'
  | 'TEST_PRINT_FAILED'
  | 'DISCONNECTED'
  | 'ERROR';

export interface BluetoothConnectionState {
  step: BluetoothConnectionStep;
  stepMessage: string;
  devices: BluetoothPairedDevice[];
  isScanning: boolean;
  connectedDeviceId: string | null;
  connectedDeviceName: string | null;
  connectedComPort: string | null;
  // Name of the real Windows printer queue registered for this device — this
  // is the name that shows up in every app's Print dialog (Ctrl+P), not just
  // inside SEZNIK.
  connectedQueueName: string | null;
  connectedDriverName: string | null;
  testPrintSuccess: boolean;
  lastTestPrintMessage: string | null;
  errorDetails?: string;
}

// IPC Channel API Interface exposed via preload contextBridge
export interface SeznikApiBridge {
  // System & Window Controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  getSystemInfo: () => Promise<{ platform: string; arch: string; version: string }>;

  // V1 Orchestrator Automated Pipeline Channels
  startV1Setup: () => Promise<V1OrchestratorState>;
  getV1State: () => Promise<V1OrchestratorState>;
  onV1StateChanged: (callback: (state: V1OrchestratorState) => void) => void;
  triggerManualV1TestPrint: () => Promise<JoshTestPrintResult>;

  // DothanTech DtpWeb Print Assistant API
  checkDtpWebPlugin: () => Promise<{ running: boolean; message: string }>;
  getDtpWebPrinters: () => Promise<{ success: boolean; printers: any[]; message: string }>;
  printDtpWebLabel: (printerName?: string) => Promise<{ success: boolean; message: string; reason?: string }>;

  // Device & Printer Monitoring
  scanDevices: () => Promise<PrinterDevice[]>;
  getConnectedPrinter: () => Promise<PrinterDevice | null>;
  getOsPrinters: () => Promise<OSPrinterInfo[]>;
  getSavedPrinters: () => Promise<SavedPrinter[]>;
  savePrinter: (printer: Partial<SavedPrinter>) => Promise<{ success: boolean; savedPrinters: SavedPrinter[]; message: string }>;
  removeSavedPrinter: (printerId: string) => Promise<RemoveSavedPrinterResult>;
  clearSavedPrinters: () => Promise<{ success: boolean; savedPrinters: SavedPrinter[]; message: string }>;
  setSavedDefaultPrinter: (printerId: string) => Promise<SetSavedDefaultResult>;
  removeSavedDefaultPrinter: () => Promise<{ success: boolean; savedPrinters: SavedPrinter[]; defaultPrinterId?: string | null; message: string }>;
  resetAndScanV1: () => Promise<V1OrchestratorState>;
  getUnspecifiedDevices: () => Promise<UnspecifiedDevice[]>;
  startUsbMonitoring: () => Promise<void>;
  stopUsbMonitoring: () => Promise<void>;

  // Bluetooth (BLE/SPP) Printer Pairing — optional, after USB setup completes
  getBluetoothState: () => Promise<BluetoothConnectionState>;
  onBluetoothStateChanged: (callback: (state: BluetoothConnectionState) => void) => void;
  scanBluetoothDevices: () => Promise<BluetoothConnectionState>;
  connectBluetoothDevice: (deviceId: string) => Promise<BluetoothConnectionState>;
  triggerBluetoothTestPrint: () => Promise<BluetoothConnectionState>;
  disconnectBluetoothDevice: () => Promise<BluetoothConnectionState>;
  forgetBluetoothDevice: (deviceId: string) => Promise<BluetoothConnectionState>;

  // Driver & Spooler Operations
  checkDriverInstalled: () => Promise<{ installed: boolean; driverName: string; queueName: string }>;
  checkVeerDriverInstalled: () => Promise<{ installed: boolean; driverName: string; queueName: string }>;
  triggerTestPrint: (printerId: string, type: 'RECEIPT' | 'LABEL') => Promise<JoshTestPrintResult>;
  installDriver: (printerId: string) => Promise<{ success: boolean; log: string }>;
  installJoshDriver: () => Promise<{ success: boolean; log: string }>;
  installVeerDriver: () => Promise<{ success: boolean; log: string }>;
  installDevDriver: () => Promise<{ success: boolean; log: string }>;
  uninstallDriver: (printerName: string) => Promise<{ success: boolean; log: string }>;
  setDefaultPrinter: (printerName: string) => Promise<{ success: boolean; message: string }>;
  printRawEscPos: (printerName: string, type: 'RECEIPT' | 'LABEL') => Promise<JoshTestPrintResult>;
  printHtmlLabel: (printerName: string, htmlContent: string) => Promise<{ success: boolean; message: string }>;
  calibratePrinter: (printerName: string) => Promise<{ success: boolean; message: string }>;
  checkFirmwareUpdate: (printerId: string) => Promise<{ updateAvailable: boolean; latestVersion?: string }>;
  updateFirmware: (printerId: string) => Promise<{ success: boolean; log: string }>;

  // Settings & Logs
  getSettings: () => Promise<SystemSettings>;
  saveSettings: (settings: Partial<SystemSettings>) => Promise<SystemSettings>;
  getLogs: () => Promise<SystemLogEntry[]>;

  // Subscriptions
  onPrinterStateChanged: (callback: (printer: PrinterDevice | null) => void) => void;
  onDeviceDetected: (callback: (device: DeviceIdentification) => void) => void;
  onLogEntry: (callback: (log: SystemLogEntry) => void) => void;
}

export type VeerBleConnectionState =
  | 'DISCONNECTED'
  | 'SCANNING'
  | 'VEER_FOUND'
  | 'IDENTITY_VERIFIED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCOVERING_SERVICES'
  | 'SERVICE_FOUND'
  | 'CHARACTERISTIC_FOUND'
  | 'READY'
  | 'PRINTING'
  | 'PRINT_SUCCESS'
  | 'ERROR';

export type VeerBleErrorCode =
  | 'BLE_DISABLED'
  | 'BLE_PERMISSION_DENIED'
  | 'VEER_NOT_FOUND'
  | 'VEER_IDENTITY_MISMATCH'
  | 'VEER_IDENTITY_AMBIGUOUS'
  | 'BLE_CONNECTION_FAILED'
  | 'BLE_DISCONNECTED'
  | 'BLE_SERVICE_NOT_FOUND'
  | 'BLE_CHARACTERISTIC_NOT_FOUND'
  | 'BLE_CHARACTERISTIC_NOT_WRITABLE'
  | 'BLE_WRITE_FAILED'
  | 'BLE_PACKET_TOO_LARGE'
  | 'BLE_CHUNK_FAILED'
  | 'BLE_TIMEOUT'
  | 'TEST_PRINT_FAILED'
  | 'PRINT_FAILED';

export interface VeerBleDevice {
  id: string;
  name: string;
  address?: string;
  rssi?: number;
  serviceUuids?: string[];
  manufacturerData?: string;
  isVeer: boolean;
}

export interface VeerBleStatus {
  state: VeerBleConnectionState;
  deviceId: string | null;
  deviceName: string | null;
  serviceUuid: string | null;
  characteristicUuid: string | null;
  mtu: number;
  errorMessage: string | null;
  errorCode: VeerBleErrorCode | null;
  lastPrintSuccess: boolean;
}

export interface VeerBlePrintResult {
  success: boolean;
  state: VeerBleConnectionState;
  errorCode?: VeerBleErrorCode;
  message: string;
  bytesSent?: number;
  chunksSent?: number;
  details?: string;
}

export interface VeerBleBridge {
  scan: () => Promise<{ success: boolean; devices: VeerBleDevice[]; message: string }>;
  connect: (deviceId: string) => Promise<{ success: boolean; status: VeerBleStatus; message: string }>;
  disconnect: () => Promise<{ success: boolean; message: string }>;
  status: () => Promise<VeerBleStatus>;
  testPrint: () => Promise<VeerBlePrintResult>;
  print: (receiptDataHexOrAscii?: string) => Promise<VeerBlePrintResult>;
  onBleStatusChanged: (callback: (status: VeerBleStatus) => void) => void;
}

declare global {
  interface Window {
    seznikApi?: SeznikApiBridge;
    veerBle?: VeerBleBridge;
  }
}



