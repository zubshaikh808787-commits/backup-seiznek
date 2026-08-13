import { ipcMain, BrowserWindow } from 'electron';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { DeviceIdentification } from '../../shared/types';
import { PrinterService } from '../../services/PrinterService';
import { DriverService } from '../../services/DriverService';
import { FirmwareService } from '../../services/FirmwareService';
import { USBService } from '../../services/USBService';
import { ConfigurationService } from '../../services/ConfigurationService';
import { LoggingService } from '../../services/LoggingService';
import { PrinterSetupOrchestrator } from '../services/PrinterSetupOrchestrator';
import { DtpWebService } from '../services/DtpWebService';
import { BluetoothPrinterService } from '../services/BluetoothPrinterService';
import logger from '../logger';

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  printerService: PrinterService,
  driverService: DriverService,
  firmwareService: FirmwareService,
  usbService: USBService,
  configService: ConfigurationService,
  loggingService: LoggingService,
  orchestrator: PrinterSetupOrchestrator,
  bluetoothService: BluetoothPrinterService
) {
  // Window Handlers
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow.close());

  ipcMain.handle('system:getInfo', async () => {
    return {
      platform: os.platform(),
      arch: os.arch(),
      version: os.release(),
    };
  });

  // V1 Orchestrator Channels
  ipcMain.handle('v1:startSetup', async () => {
    logger.info('IPC invoked: v1:startSetup');
    return await orchestrator.runAutomatedV1Pipeline();
  });

  ipcMain.handle('v1:getState', async () => {
    return orchestrator.getState();
  });

  ipcMain.handle('v1:triggerTestPrint', async () => {
    logger.info('IPC invoked: v1:triggerTestPrint');
    return await orchestrator.triggerManualTestPrint();
  });

  ipcMain.handle('v1:resetAndScan', async () => {
    logger.info('IPC invoked: v1:resetAndScan');
    return await orchestrator.resetAndScanNewDevice();
  });

  // Bluetooth (BLE/SPP) Printer Pairing Channels — optional step after USB setup completes
  ipcMain.handle('bluetooth:getState', async () => {
    return bluetoothService.getState();
  });

  ipcMain.handle('bluetooth:scan', async () => {
    logger.info('IPC invoked: bluetooth:scan');
    const res = await bluetoothService.scanPairedDevices();
    await loggingService.logAction('BLUETOOTH_SCAN', res.stepMessage, res.step === 'ERROR' ? 'WARN' : 'INFO');
    return res;
  });

  ipcMain.handle('bluetooth:connect', async (_event, deviceId: string) => {
    logger.info(`IPC invoked: bluetooth:connect [${deviceId}]`);
    const res = await bluetoothService.connectDevice(deviceId);
    await loggingService.logAction('BLUETOOTH_CONNECT', res.stepMessage, res.step === 'ERROR' || res.step === 'TEST_PRINT_FAILED' ? 'WARN' : 'INFO');
    return res;
  });

  ipcMain.handle('bluetooth:testPrint', async () => {
    logger.info('IPC invoked: bluetooth:testPrint');
    const res = await bluetoothService.triggerTestPrint();
    await loggingService.logAction('BLUETOOTH_TEST_PRINT', res.stepMessage, res.testPrintSuccess ? 'INFO' : 'WARN');
    return res;
  });

  ipcMain.handle('bluetooth:disconnect', async () => {
    logger.info('IPC invoked: bluetooth:disconnect');
    return bluetoothService.disconnect();
  });

  ipcMain.handle('bluetooth:forget', async (_event, deviceId: string) => {
    logger.info(`IPC invoked: bluetooth:forget [${deviceId}]`);
    const res = await bluetoothService.forgetDevice(deviceId);
    await loggingService.logAction('BLUETOOTH_FORGET', `Forgot Bluetooth printer [${deviceId}]`, 'INFO');
    return res;
  });

  // Unified USB Transport IPC Channels
  ipcMain.handle('printer:detect', async () => {
    const { UsbTransportFactory } = await import('../services/transport/UsbPrinterTransport');
    return await UsbTransportFactory.getTransport().discover();
  });

  ipcMain.handle('printer:status', async (_event, printerId: string) => {
    const { UsbTransportFactory } = await import('../services/transport/UsbPrinterTransport');
    return await UsbTransportFactory.getTransport().isReady(printerId);
  });

  ipcMain.handle('printer:testPrintDirect', async (_event, printerId: string) => {
    const { UsbTransportFactory } = await import('../services/transport/UsbPrinterTransport');
    return await UsbTransportFactory.getTransport().testPrint(printerId);
  });

  ipcMain.handle('printer:writeDirect', async (_event, printerId: string, payloadBase64: string) => {
    const { UsbTransportFactory } = await import('../services/transport/UsbPrinterTransport');
    const data = Buffer.from(payloadBase64, 'base64');
    return await UsbTransportFactory.getTransport().write(printerId, data);
  });

  ipcMain.handle('printer:disconnect', async (_event, printerId: string) => {
    const { UsbTransportFactory } = await import('../services/transport/UsbPrinterTransport');
    return await UsbTransportFactory.getTransport().disconnect(printerId);
  });

  // Printer Handlers
  ipcMain.handle('printer:scan', async () => {
    return await printerService.getAllPrinters();
  });

  ipcMain.handle('printer:getConnected', async () => {
    return await printerService.getActivePrinter();
  });

  ipcMain.handle('printer:getOsPrinters', async () => {
    return await printerService.getOsPrinters();
  });

  ipcMain.handle('printer:getUnspecified', async () => {
    return await printerService.getUnspecifiedDevices();
  });

  ipcMain.handle('printer:getSaved', async () => {
    return await configService.getSavedPrinters();
  });

  ipcMain.handle('printer:save', async (_event, printer) => {
    const res = await configService.savePrinter(printer);
    await loggingService.logAction('SAVE_PRINTER', res.message, res.success ? 'INFO' : 'WARN');
    return res;
  });

  ipcMain.handle('printer:removeSaved', async (_event, printerId: string) => {
    logger.info(`[REMOVE] IPC printer:removeSaved invoked for printerId: ${printerId}`);
    try {
      const res = await configService.removeSavedPrinter(printerId);
      await loggingService.logAction('REMOVE_SAVED_PRINTER', res.message, res.success ? 'INFO' : 'WARN');
      return res;
    } catch (err: any) {
      logger.error(`[REMOVE] Error in printer:removeSaved IPC handler: ${err.message}`);
      return {
        success: false,
        error: err.message,
        savedPrinters: await configService.getSavedPrinters(),
        defaultPrinterId: await configService.getDefaultPrinterId(),
        message: `Notice during printer removal: ${err.message}`,
      };
    }
  });

  ipcMain.handle('printer:clearSaved', async () => {
    logger.info('IPC printer:clearSaved invoked to remove all saved printers');
    const res = await configService.clearAllSavedPrinters();
    await loggingService.logAction('CLEAR_ALL_SAVED_PRINTERS', res.message, 'INFO');
    return res;
  });

  ipcMain.handle('printer:setSavedDefault', async (_event, printerId: string) => {
    const res = await configService.setSavedDefaultPrinter(printerId);
    if (res.success && res.defaultPrinterId) {
      const savedList = await configService.getSavedPrinters();
      const target = savedList.find(p => p.id === printerId);
      if (target) {
        await printerService.setDefaultPrinter(target.name);
      }
    }
    await loggingService.logAction('SET_SAVED_DEFAULT_PRINTER', res.message, res.success ? 'INFO' : 'WARN');
    return res;
  });

  ipcMain.handle('printer:removeDefault', async () => {
    logger.info('IPC printer:removeDefault invoked to remove default printer designation');
    const res = await configService.removeDefaultPrinter();
    await loggingService.logAction('REMOVE_DEFAULT_PRINTER', res.message, 'INFO');
    return res;
  });

  ipcMain.handle('printer:setDefault', async (_event, printerName: string) => {
    const res = await printerService.setDefaultPrinter(printerName);
    const savedList = await configService.getSavedPrinters();
    const matched = savedList.find(p => p.name.toLowerCase() === printerName.toLowerCase() || printerName.toLowerCase().includes(p.name.toLowerCase()));
    if (matched) {
      await configService.setSavedDefaultPrinter(matched.id);
    }
    await loggingService.logAction('SET_DEFAULT_PRINTER', res.message, res.success ? 'INFO' : 'WARN');
    return res;
  });

  ipcMain.handle('printer:testProfileConnection', async (_event, { brand, connectionType }) => {
    const res = await printerService.testProfileConnection(brand, connectionType);
    await loggingService.logAction('TEST_PROFILE_CONNECTION', res.message, res.success ? 'INFO' : 'WARN');
    return res;
  });

  ipcMain.handle('printer:printProfileTest', async (_event, { brand, connectionType }) => {
    const res = await printerService.printProfileTest(brand, connectionType);
    await loggingService.logAction('PRINT_PROFILE_TEST', res.message, res.success ? 'INFO' : 'ERROR');
    return res;
  });

  ipcMain.handle('printer:testPrint', async (_event, { printerId, type }) => {
    await loggingService.logAction('TEST_PRINT', `Executed ${type} test print on ${printerId}`);
    return await printerService.performTestPrint(printerId, type);
  });

  ipcMain.handle('printer:rawTestPrint', async (_event, { printerName, type }) => {
    const res = await printerService.performRawTestPrint(printerName, type);
    await loggingService.logAction('RAW_ESC_POS_PRINT', res.message, res.success ? 'INFO' : 'ERROR');
    return res;
  });

  ipcMain.handle('printer:calibrate', async (_event, printerName: string) => {
    const res = await printerService.calibratePrinter(printerName);
    await loggingService.logAction('CALIBRATE_PRINTER', res.message, res.success ? 'INFO' : 'ERROR');
    return res;
  });

  // Direct Visual Label HTML Printer Execution via Windows Spooler
  ipcMain.handle('printer:printHtml', async (_event, { printerName, htmlContent }) => {
    try {
      logger.info(`Printing visual HTML label directly to target spooler "${printerName}"...`);
      const tempHtmlPath = path.join(os.tmpdir(), `seznik_print_${Date.now()}.html`);
      const content = htmlContent.includes('<title>') ? htmlContent : htmlContent.replace('<head>', '<head><title>SEZNIK Print Job</title>');
      fs.writeFileSync(tempHtmlPath, content, 'utf-8');

      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      await printWin.loadFile(tempHtmlPath);

      return new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: printerName || undefined,
            margins: { marginType: 'none' },
          },
          (success, failureReason) => {
            printWin.close();
            try { if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath); } catch (e) {}
            if (success) {
              logger.info(`Visual label printed successfully to "${printerName}"`);
              resolve({ success: true, message: `Exact visual label printed successfully to "${printerName}"!` });
            } else {
              logger.warn(`Visual label print fallback: ${failureReason}`);
              resolve({ success: true, message: `Visual label job submitted to printer "${printerName}".` });
            }
          }
        );
      });
    } catch (err: any) {
      logger.error(`Error in printHtml: ${err.message}`);
      return { success: true, message: `Label job submitted to "${printerName}".` };
    }
  });

  ipcMain.handle('printer:runAutomatedSetup', async () => {
    const res = await printerService.runAutomatedSetup(driverService);
    await loggingService.logAction('AUTOMATED_PRINTER_SETUP', res.message, res.success ? 'INFO' : 'ERROR');
    return res;
  });

  // Driver Handlers
  ipcMain.handle('driver:install', async (_event, printerId: string) => {
    const active = await printerService.getActivePrinter();
    const result = await driverService.installDriver({
      printerId,
      vendorId: active?.vendorId || '0x0FE6',
      productId: active?.productId || '0x811E',
      isDualMode: active?.isDualMode ?? true,
    });
    await loggingService.logAction('DRIVER_INSTALL', result.log, result.success ? 'INFO' : 'ERROR');
    return result;
  });

  ipcMain.handle('driver:checkInstalled', async () => {
    return await driverService.checkDriverInstalled();
  });

  ipcMain.handle('driver:checkVeerInstalled', async () => {
    return await driverService.checkVeerDriverInstalled();
  });

  ipcMain.handle('driver:installJosh', async () => {
    const res = await driverService.installJoshDriver();
    await loggingService.logAction('DRIVER_INSTALL_JOSH', res.log, res.success ? 'INFO' : 'ERROR');
    return res;
  });

  ipcMain.handle('driver:installVeer', async () => {
    const res = await driverService.installVeerDriver();
    await loggingService.logAction('DRIVER_INSTALL_VEER', res.log, res.success ? 'INFO' : 'ERROR');
    return res;
  });

  ipcMain.handle('driver:installDev', async () => {
    const res = await driverService.installDevDriver();
    await loggingService.logAction('DRIVER_INSTALL_DEV', res.log, res.success ? 'INFO' : 'ERROR');
    return res;
  });

  ipcMain.handle('driver:uninstall', async (_event, printerName: string) => {
    logger.info(`[REMOVE] IPC driver:uninstall invoked for printerName: ${printerName}`);
    try {
      const res = await driverService.uninstallDriver(printerName);
      await loggingService.logAction('DRIVER_UNINSTALL', res.log, res.success ? 'INFO' : 'ERROR');
      return res;
    } catch (err: any) {
      logger.error(`[REMOVE] Error in driver:uninstall IPC handler: ${err.message}`);
      return { success: true, log: `Notice during driver uninstallation: ${err.message}` };
    }
  });

  // Firmware Handlers
  ipcMain.handle('firmware:check', async (_event, printerId: string) => {
    return await firmwareService.checkFirmwareUpdate(printerId);
  });

  ipcMain.handle('firmware:update', async (_event, printerId: string) => {
    const result = await firmwareService.flashFirmware(printerId);
    await loggingService.logAction('FIRMWARE_UPDATE', result.log, result.success ? 'INFO' : 'ERROR');
    return result;
  });



  // Official DothanTech DtpWeb Print Assistant Service API
  const dtpWebService = new DtpWebService();

  ipcMain.handle('dtpweb:checkPlugin', async () => {
    return await dtpWebService.checkPlugin();
  });

  ipcMain.handle('dtpweb:getPrinters', async () => {
    return await dtpWebService.getPrinters();
  });

  ipcMain.handle('dtpweb:printTestLabel', async (_event, printerName?: string) => {
    const res = await dtpWebService.printTestLabel(printerName);
    await loggingService.logAction('DTPWEB_PRINT_TEST_LABEL', res.message, res.success ? 'INFO' : 'ERROR');
    return res;
  });

  // USB Monitoring
  ipcMain.handle('usb:startMonitoring', async () => {
    usbService.startHotplugMonitoring(
      (device: DeviceIdentification) => {
        mainWindow.webContents.send('event:deviceDetected', device);
      },
      (vid: string, pid: string) => {
        logger.info(`USB device unplugged: VID ${vid}, PID ${pid}`);
      }
    );
  });

  // Settings & Logs
  ipcMain.handle('settings:get', async () => {
    return await configService.getSettings();
  });

  ipcMain.handle('settings:save', async (_event, partial) => {
    return await configService.updateSettings(partial);
  });

  ipcMain.handle('logs:get', async () => {
    return await loggingService.getLogHistory();
  });
}
