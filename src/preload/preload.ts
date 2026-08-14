import { contextBridge, ipcRenderer } from 'electron';
import { SeznikApiBridge, PrinterDevice, DeviceIdentification, SystemLogEntry, SystemSettings, V1OrchestratorState, VeerBleBridge, VeerBleStatus } from '../shared/types';

const seznikApi: SeznikApiBridge = {
  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),

  // V1 Orchestrator Channels
  startV1Setup: () => ipcRenderer.invoke('v1:startSetup'),
  getV1State: () => ipcRenderer.invoke('v1:getState'),
  onV1StateChanged: (callback: (state: V1OrchestratorState) => void) => {
    ipcRenderer.on('event:v1StateChanged', (_event, state) => callback(state));
  },
  triggerManualV1TestPrint: () => ipcRenderer.invoke('v1:triggerTestPrint'),

  // Hardware & Printers
  scanDevices: () => ipcRenderer.invoke('printer:scan'),
  getConnectedPrinter: () => ipcRenderer.invoke('printer:getConnected'),
  getOsPrinters: () => ipcRenderer.invoke('printer:getOsPrinters'),
  getSavedPrinters: () => ipcRenderer.invoke('printer:getSaved'),
  savePrinter: (printer) => ipcRenderer.invoke('printer:save', printer),
  removeSavedPrinter: (printerId: string) => ipcRenderer.invoke('printer:removeSaved', printerId),
  clearSavedPrinters: () => ipcRenderer.invoke('printer:clearSaved'),
  setSavedDefaultPrinter: (printerId: string) => ipcRenderer.invoke('printer:setSavedDefault', printerId),
  removeSavedDefaultPrinter: () => ipcRenderer.invoke('printer:removeDefault'),
  resetAndScanV1: () => ipcRenderer.invoke('v1:resetAndScan'),
  getUnspecifiedDevices: () => ipcRenderer.invoke('printer:getUnspecified'),
  startUsbMonitoring: () => ipcRenderer.invoke('usb:startMonitoring'),
  stopUsbMonitoring: () => ipcRenderer.invoke('usb:stopMonitoring'),

  // Official DothanTech DtpWeb Print Assistant API Bridge
  checkDtpWebPlugin: () => ipcRenderer.invoke('dtpweb:checkPlugin'),
  getDtpWebPrinters: () => ipcRenderer.invoke('dtpweb:getPrinters'),
  printDtpWebLabel: (printerName?: string) => ipcRenderer.invoke('dtpweb:printTestLabel', printerName),

  // Operations
  checkDriverInstalled: () => ipcRenderer.invoke('driver:checkInstalled'),
  checkVeerDriverInstalled: () => ipcRenderer.invoke('driver:checkVeerInstalled'),
  triggerTestPrint: (printerId: string, type: 'RECEIPT' | 'LABEL') =>
    ipcRenderer.invoke('printer:testPrint', { printerId, type }),
  installDriver: (printerId: string) => ipcRenderer.invoke('driver:install', printerId),
  installJoshDriver: () => ipcRenderer.invoke('driver:installJosh'),
  installVeerDriver: () => ipcRenderer.invoke('driver:installVeer'),
  installDevDriver: () => ipcRenderer.invoke('driver:installDev'),
  uninstallDriver: (printerName: string) => ipcRenderer.invoke('driver:uninstall', printerName),
  setDefaultPrinter: (printerName: string) => ipcRenderer.invoke('printer:setDefault', printerName),
  printRawEscPos: (printerName: string, type: 'RECEIPT' | 'LABEL') =>
    ipcRenderer.invoke('printer:rawTestPrint', { printerName, type }),
  printHtmlLabel: (printerName: string, htmlContent: string) =>
    ipcRenderer.invoke('printer:printHtml', { printerName, htmlContent }),
  calibratePrinter: (printerName: string) => ipcRenderer.invoke('printer:calibrate', printerName),
  checkFirmwareUpdate: (printerId: string) => ipcRenderer.invoke('firmware:check', printerId),
  updateFirmware: (printerId: string) => ipcRenderer.invoke('firmware:update', printerId),

  // Settings & Logs
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<SystemSettings>) => ipcRenderer.invoke('settings:save', settings),
  getLogs: () => ipcRenderer.invoke('logs:get'),

  // Callbacks
  onPrinterStateChanged: (callback: (printer: PrinterDevice | null) => void) => {
    ipcRenderer.on('event:printerStateChanged', (_event, printer) => callback(printer));
  },
  onDeviceDetected: (callback: (device: DeviceIdentification) => void) => {
    ipcRenderer.on('event:deviceDetected', (_event, device) => callback(device));
  },
  onLogEntry: (callback: (log: SystemLogEntry) => void) => {
    ipcRenderer.on('event:logEntry', (_event, log) => callback(log));
  },
};

contextBridge.exposeInMainWorld('seznikApi', seznikApi);

const veerBle: VeerBleBridge = {
  scan: () => ipcRenderer.invoke('veerBle:scan'),
  connect: (deviceId: string) => ipcRenderer.invoke('veerBle:connect', deviceId),
  disconnect: () => ipcRenderer.invoke('veerBle:disconnect'),
  status: () => ipcRenderer.invoke('veerBle:status'),
  testPrint: () => ipcRenderer.invoke('veerBle:testPrint'),
  print: (receiptDataHexOrAscii?: string) => ipcRenderer.invoke('veerBle:print', receiptDataHexOrAscii),
  onBleStatusChanged: (callback: (status: VeerBleStatus) => void) => {
    ipcRenderer.on('veerBle:statusChanged', (_event, status) => callback(status));
  },
};

contextBridge.exposeInMainWorld('veerBle', veerBle);

