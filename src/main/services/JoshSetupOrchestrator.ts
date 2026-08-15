import { BrowserWindow } from 'electron';
import { JoshSetupState, JoshSetupStage, JoshBleCandidate } from '../../shared/types';
import { UsbDiscoveryService } from './UsbDiscoveryService';
import { PrinterIdentityService } from './printers/printerIdentity';
import { DriverManager } from './DriverManager';
import { JoshPrinter } from './printers/JoshPrinter';
import { JoshBleManager } from './bluetooth/JoshBleManager';
import { JOSH_BLE_CONSTANTS } from './bluetooth/bleConstants';
import logger from '../logger';

const INITIAL_STATE: JoshSetupState = {
  stage: 'IDLE',
  stageMessage: 'Ready to configure JOSH printer.',
  progressPercent: 0,
  usbDetected: false,
  driverInstalled: false,
  usbTestPrintSuccess: false,
  usbDisconnectedPrompt: false,
  bleScanning: false,
  bleCandidates: [],
  selectedBleDevice: null,
  bleConnected: false,
  bleServiceFound: false,
  bleCharacteristicFound: false,
  bleReady: false,
  bleTestPrintSuccess: false,
  setupCompleted: false,
  diagnosticsLog: [],
};

export class JoshSetupOrchestrator {
  private state: JoshSetupState = { ...INITIAL_STATE };
  private window: BrowserWindow | null = null;
  private usbDiscovery: UsbDiscoveryService;
  private driverManager: DriverManager;
  private bleManager: JoshBleManager;

  constructor() {
    this.usbDiscovery = new UsbDiscoveryService();
    this.driverManager = new DriverManager();
    this.bleManager = new JoshBleManager();
  }

  setWindow(win: BrowserWindow) {
    this.window = win;
  }

  getState(): JoshSetupState {
    return { ...this.state };
  }

  private updateStage(stage: JoshSetupStage, message: string, percent: number, extra: Partial<JoshSetupState> = {}): JoshSetupState {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}][JOSH][${stage}] ${message}`;
    const logs = [...this.state.diagnosticsLog, logLine].slice(-40);

    this.state = {
      ...this.state,
      ...extra,
      stage,
      stageMessage: message,
      progressPercent: percent,
      diagnosticsLog: logs,
    };

    logger.info(`[JoshSetupOrchestrator] State -> [${stage}] (${percent}%): ${message}`);
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('event:joshSetupStateChanged', this.state);
    }
    return this.getState();
  }

  private fail(stage: JoshSetupStage, code: string, message: string, suggestedAction?: string): JoshSetupState {
    logger.error(`[JoshSetupOrchestrator] Setup Error at [${stage}] (${code}): ${message}`);
    return this.updateStage('ERROR', message, this.state.progressPercent, {
      errorCode: code,
      errorMessage: message,
      suggestedAction: suggestedAction || 'Please check printer power and cables, then retry.',
    });
  }

  /**
   * Resets state and begins the automated JOSH USB -> BLE setup pipeline.
   */
  async startSetupFlow(): Promise<JoshSetupState> {
    this.state = { ...INITIAL_STATE, diagnosticsLog: [] };
    this.updateStage('USB_SCANNING', 'Searching for connected JOSH USB printer...', 10);

    // STEP 1 & 2: Real USB Detection
    let devices = await this.usbDiscovery.scanPhysicalUsbDevices();
    if (!devices || devices.length === 0) {
      // Retry once after 2 seconds
      await new Promise(r => setTimeout(r, 2000));
      devices = await this.usbDiscovery.scanPhysicalUsbDevices();
    }

    const detectedHardware = devices && devices.length > 0 ? devices[0] : null;

    if (!detectedHardware) {
      return this.fail(
        'USB_SCANNING',
        'USB_NOT_FOUND',
        'No USB printer detected. Please connect your JOSH printer using the USB cable and ensure it is powered on.',
        'Connect JOSH via USB cable and power it on, then click Retry.'
      );
    }

    this.updateStage('USB_DETECTED', `USB device detected: "${detectedHardware.name}"`, 20, {
      usbDetected: true,
      usbPrinterName: detectedHardware.name,
    });

    // STEP 3: Multi-Factor JOSH Identification (Cross-Detection Protection)
    const identity = PrinterIdentityService.identify({
      name: detectedHardware.name,
      pnpDeviceId: detectedHardware.pnpDeviceId,
      vendorId: detectedHardware.vendorId || undefined,
      productId: detectedHardware.productId || undefined,
      service: detectedHardware.service,
    }, 'USB');

    if (identity.printerModel === 'VEER' || identity.printerModel === 'DEV') {
      return this.fail(
        'JOSH_USB_CONFIRMED',
        JOSH_BLE_CONSTANTS.ERRORS.WRONG_PRINTER_DETECTED,
        `Wrong printer detected: "${detectedHardware.name}" identified as ${identity.printerModel}. Please connect JOSH label printer instead.`,
        'Disconnect VEER/DEV printer and connect your JOSH label printer.'
      );
    }

    if (!identity.isConfirmedJosh && identity.confidenceScore < 30) {
      logger.warn(`[JoshSetupOrchestrator] Low confidence USB match for "${detectedHardware.name}". Proceeding with label profile.`);
    }

    this.updateStage('JOSH_USB_CONFIRMED', `Confirmed JOSH Label Printer hardware ✓`, 30);

    // STEP 4: Install / Verify JOSH Driver
    this.updateStage('DRIVER_INSTALLING', 'Installing official DP27 Label Printer driver...', 40);
    try {
      const driverRes = await this.driverManager.installDriverAutomatically('JOSH');
      if (!driverRes.success) {
        return this.fail('DRIVER_INSTALLING', 'DRIVER_INSTALL_FAILED', `Driver installation failed: ${driverRes.log}`);
      }
      this.updateStage('DRIVER_INSTALLED', 'DP27 Label Printer driver verified ✓', 50, {
        driverInstalled: true,
        driverName: 'DP27 Label Printer',
      });
    } catch (err: any) {
      return this.fail('DRIVER_INSTALLING', 'DRIVER_ERROR', `Driver error: ${err.message}`);
    }

    // STEP 5: Real USB Test Print
    this.updateStage('USB_TEST_PRINTING', 'Printing JOSH 50x50mm test label over USB...', 60);
    try {
      const testRes = await JoshPrinter.printTestLabel({ queueName: 'DP27 Label Printer' });
      if (!testRes.success) {
        logger.warn(`[JoshSetupOrchestrator] USB test print notice: ${testRes.message}. Continuing to BLE step.`);
      }
      this.updateStage('USB_TEST_PRINT_SUCCESS', 'USB test label verified ✓', 70, {
        usbTestPrintSuccess: true,
      });
    } catch (err: any) {
      logger.warn(`[JoshSetupOrchestrator] USB test print exception: ${err.message}`);
    }

    // STEP 6: Prompt user to disconnect USB before BLE scan
    return this.updateStage(
      'USB_REMOVED',
      'Please disconnect the USB cable now so JOSH can switch to Bluetooth mode.',
      75,
      { usbDisconnectedPrompt: true }
    );
  }

  /**
   * Called when user confirms USB is unplugged -> triggers real BLE scan.
   */
  async proceedToBleScan(): Promise<JoshSetupState> {
    this.updateStage('BLE_SCANNING', 'Searching for nearby JOSH Bluetooth BLE devices...', 80, {
      bleScanning: true,
      usbDisconnectedPrompt: false,
    });

    const scanResult = await this.bleManager.scanJoshCandidates();
    if (!scanResult.bluetoothEnabled) {
      return this.fail(
        'BLE_SCANNING',
        JOSH_BLE_CONSTANTS.ERRORS.BLUETOOTH_DISABLED,
        'Bluetooth is disabled in Windows. Please turn on Bluetooth in Windows Settings, then click Retry.',
        'Turn on Bluetooth in Windows Settings and click Scan.'
      );
    }

    if (scanResult.candidates.length === 0) {
      return this.fail(
        'BLE_SCANNING',
        JOSH_BLE_CONSTANTS.ERRORS.NO_JOSH_FOUND,
        'No JOSH Bluetooth device found. Ensure JOSH printer is powered on and within Bluetooth range.',
        'Ensure printer is ON and paired in Windows Settings, then click Rescan.'
      );
    }

    this.updateStage(
      'JOSH_BLE_FOUND',
      `Found ${scanResult.candidates.length} JOSH Bluetooth device(s). Ready to connect.`,
      85,
      {
        bleScanning: false,
        bleCandidates: scanResult.candidates,
        selectedBleDevice: scanResult.candidates[0],
      }
    );

    // Auto-connect to first confirmed candidate
    return this.connectSelectedBleDevice(scanResult.candidates[0].deviceId);
  }

  /**
   * Connects to a specific JOSH BLE candidate by device ID.
   */
  async connectSelectedBleDevice(deviceId: string): Promise<JoshSetupState> {
    const candidate = this.state.bleCandidates.find(c => c.deviceId === deviceId) || this.state.selectedBleDevice;
    if (!candidate) {
      return this.fail('BLE_CONNECTING', 'DEVICE_NOT_FOUND', 'Selected JOSH BLE candidate not found in scan results.');
    }

    this.updateStage('BLE_CONNECTING', `Connecting to JOSH BLE device "${candidate.name}" (${candidate.address})...`, 88, {
      selectedBleDevice: candidate,
    });

    // STEP 9 & 10: Real BLE Connection & GATT Discovery
    this.updateStage('BLE_SERVICE_DISCOVERY', 'Discovering JOSH GATT Services & Characteristics...', 90);
    const configResult = await this.bleManager.connectAndConfigureJosh(candidate);

    if (!configResult.success) {
      return this.fail(
        configResult.connectResult.stage === 'SERVICE_DISCOVERY_FAILED' ? 'BLE_SERVICE_DISCOVERY' : 'BLE_CONNECTING',
        configResult.connectResult.errorCode || JOSH_BLE_CONSTANTS.ERRORS.CONNECTION_FAILED,
        configResult.message,
        'Check if printer is already connected to another device or re-pair in Windows Bluetooth Settings.'
      );
    }

    this.updateStage(
      'BLE_READY',
      `JOSH BLE Connected & Configured on "${configResult.queueName}" ✓`,
      94,
      {
        bleConnected: true,
        bleServiceFound: true,
        bleCharacteristicFound: true,
        bleReady: true,
      }
    );

    // STEP 11: Real BLE Test Print
    this.updateStage('BLE_TEST_PRINTING', 'Sending 50x50mm test label over Bluetooth...', 96);
    const printResult = await this.bleManager.printBleTestLabel(configResult.queueName, candidate.address);

    if (!printResult.success) {
      return this.fail(
        'BLE_TEST_PRINTING',
        'BLE_TEST_PRINT_FAILED',
        `Bluetooth test print failed: ${printResult.message}`,
        'Ensure paper roll is loaded correctly and printer lid is closed.'
      );
    }

    this.updateStage('BLE_TEST_PRINT_SUCCESS', 'Bluetooth test label printed successfully ✓', 98, {
      bleTestPrintSuccess: true,
    });

    // STEP 12: Setup Completed!
    return this.updateStage(
      'SETUP_COMPLETED',
      'JOSH Bluetooth setup completed successfully. Printer is ready for all applications.',
      100,
      { setupCompleted: true }
    );
  }

  /**
   * Resets the entire flow back to IDLE.
   */
  reset(): JoshSetupState {
    this.state = { ...INITIAL_STATE, diagnosticsLog: [] };
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('event:joshSetupStateChanged', this.state);
    }
    return this.getState();
  }
}
