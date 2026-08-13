import { app, BrowserWindow, Tray, Menu } from 'electron';
import path from 'path';
import logger from './logger';
import { registerIpcHandlers } from './ipc';
import { PrinterService } from '../services/PrinterService';
import { DriverService } from '../services/DriverService';
import { FirmwareService } from '../services/FirmwareService';
import { USBService } from '../services/USBService';
import { ConfigurationService } from '../services/ConfigurationService';
import { LoggingService } from '../services/LoggingService';
import { PrinterSetupOrchestrator } from './services/PrinterSetupOrchestrator';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Service instances
const printerService = new PrinterService();
const driverService = new DriverService();
const firmwareService = new FirmwareService();
const usbService = new USBService();
const configService = new ConfigurationService();
const loggingService = new LoggingService();
const orchestrator = new PrinterSetupOrchestrator();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Custom Windows 11 Fluent frame UI
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  orchestrator.setWindow(mainWindow);
  orchestrator.startUsbMonitoring();

  // Run V1 automated setup automatically on window load
  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('V1 App Loaded. Triggering automated V1 USB pipeline...');
    orchestrator.runAutomatedV1Pipeline();
  });

  registerIpcHandlers(
    mainWindow,
    printerService,
    driverService,
    firmwareService,
    usbService,
    configService,
    loggingService,
    orchestrator
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Electron main browser window created successfully.');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

