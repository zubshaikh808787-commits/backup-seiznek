import { ipcMain, BrowserWindow } from 'electron';
import { JoshSetupOrchestrator } from '../services/JoshSetupOrchestrator';
import { JoshBleDiagnostics } from '../services/bluetooth/bleDiagnostics';
import logger from '../logger';

export function registerJoshIpcHandlers(mainWindow: BrowserWindow): JoshSetupOrchestrator {
  const orchestrator = new JoshSetupOrchestrator();
  orchestrator.setWindow(mainWindow);
  const diagnostics = new JoshBleDiagnostics();

  ipcMain.handle('josh:startSetup', async () => {
    logger.info('[IPC] josh:startSetup received');
    return orchestrator.startSetupFlow();
  });

  ipcMain.handle('josh:getState', async () => {
    return orchestrator.getState();
  });

  ipcMain.handle('josh:confirmUsbDisconnected', async () => {
    logger.info('[IPC] josh:confirmUsbDisconnected received -> proceeding to BLE scan');
    return orchestrator.proceedToBleScan();
  });

  ipcMain.handle('josh:selectBleDevice', async (_event, deviceId: string) => {
    logger.info(`[IPC] josh:selectBleDevice received: ${deviceId}`);
    return orchestrator.connectSelectedBleDevice(deviceId);
  });

  ipcMain.handle('josh:triggerBleTestPrint', async () => {
    logger.info('[IPC] josh:triggerBleTestPrint received');
    const state = orchestrator.getState();
    if (state.selectedBleDevice) {
      return orchestrator.connectSelectedBleDevice(state.selectedBleDevice.deviceId);
    }
    return orchestrator.getState();
  });

  ipcMain.handle('josh:resetSetup', async () => {
    logger.info('[IPC] josh:resetSetup received');
    return orchestrator.reset();
  });

  ipcMain.handle('josh:getDiagnosticReport', async () => {
    logger.info('[IPC] josh:getDiagnosticReport received');
    return diagnostics.generateFullReport();
  });

  ipcMain.handle('josh:runDiagnosticSelfTest', async () => {
    logger.info('[IPC] josh:runDiagnosticSelfTest received');
    return diagnostics.generateFullReport();
  });

  return orchestrator;
}
