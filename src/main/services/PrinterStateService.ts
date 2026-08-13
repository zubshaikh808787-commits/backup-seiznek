import { BrowserWindow } from 'electron';
import { V1OrchestratorState, V1SetupStep, V1PrinterProfileBrand } from '../../shared/types';
import logger from '../logger';

export class PrinterStateService {
  private state: V1OrchestratorState = {
    step: 'NO_USB_CONNECTED',
    stepMessage: 'No USB printer detected. Please connect a physical USB printer.',
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
  };

  private window: BrowserWindow | null = null;

  setWindow(win: BrowserWindow | null) {
    this.window = win;
  }

  getState(): V1OrchestratorState {
    return { ...this.state };
  }

  updateState(partial: Partial<V1OrchestratorState>): V1OrchestratorState {
    this.state = { ...this.state, ...partial };
    logger.info(`[PrinterStateService] State Updated -> Step: [${this.state.step}] Message: "${this.state.stepMessage}"`);

    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('event:v1StateChanged', this.state);
    }

    return this.getState();
  }

  resetState(): V1OrchestratorState {
    return this.updateState({
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
    });
  }

  setError(errorMessage: string) {
    this.updateState({
      step: 'ERROR',
      stepMessage: `Error: ${errorMessage}`,
      errorDetails: errorMessage,
    });
  }
}
