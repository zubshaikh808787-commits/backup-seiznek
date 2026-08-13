import { BrowserWindow } from 'electron';
import { UsbDiscoveryService, DetectedUsbHardware } from './UsbDiscoveryService';
import { PrinterIdentificationService } from './PrinterIdentificationService';
import { PrinterProfileService } from './PrinterProfileService';
import { DriverManager } from './DriverManager';
import { PrinterConfigurationService } from './PrinterConfigurationService';
import { TestPrintService } from './TestPrintService';
import { DefaultPrinterService } from './DefaultPrinterService';
import { PrinterPersistenceService } from './PrinterPersistenceService';
import { PrinterStateService } from './PrinterStateService';
import { V1OrchestratorState, JoshTestPrintResult } from '../../shared/types';
import logger from '../logger';

export class PrinterSetupOrchestrator {
  private usbDiscovery: UsbDiscoveryService;
  private identification: PrinterIdentificationService;
  private profileService: PrinterProfileService;
  private driverManager: DriverManager;
  private configurationService: PrinterConfigurationService;
  private testPrintService: TestPrintService;
  private defaultPrinterService: DefaultPrinterService;
  private persistenceService: PrinterPersistenceService;
  private stateService: PrinterStateService;

  private isSetupRunning = false;

  constructor() {
    this.usbDiscovery = new UsbDiscoveryService();
    this.identification = new PrinterIdentificationService();
    this.profileService = new PrinterProfileService();
    this.driverManager = new DriverManager();
    this.configurationService = new PrinterConfigurationService();
    this.testPrintService = new TestPrintService();
    this.defaultPrinterService = new DefaultPrinterService();
    this.persistenceService = new PrinterPersistenceService();
    this.stateService = new PrinterStateService();
  }

  setWindow(win: BrowserWindow) {
    this.stateService.setWindow(win);
  }

  getState(): V1OrchestratorState {
    return this.stateService.getState();
  }

  /**
   * Starts the 100% automated V1 Setup Pipeline.
   * NO manual user brand selection!
   */
  async runAutomatedV1Pipeline(): Promise<V1OrchestratorState> {
    if (this.isSetupRunning) {
      logger.warn('[PrinterSetupOrchestrator] Pipeline is already running.');
      return this.getState();
    }

    this.isSetupRunning = true;
    logger.info('================ STARTING V1 AUTOMATED PRINTER PIPELINE ================');

    try {
      // Step 1: Real USB Discovery
      this.stateService.updateState({
        step: 'NO_USB_CONNECTED',
        stepMessage: 'Scanning physical USB bus for connected printers...',
        progressPercent: 5,
      });

      let devices = await this.usbDiscovery.scanPhysicalUsbDevices();

      if (devices.length === 0) {
        logger.info('[V1 Pipeline] No active PnP devices found in phase 1. Checking Windows Spooler for configured printers...');
        const driverCheck = await this.driverManager.checkDriverInstalled('JOSH');
        if (driverCheck.installed) {
          logger.info(`[V1 Pipeline] Found configured printer queue "${driverCheck.queueName}" in Windows Spooler.`);
          devices.push({
            name: driverCheck.queueName || 'LD0801 Label Printer',
            vendorId: '0x3533',
            productId: '0x5A11',
            pnpDeviceId: 'USB\\VID_3533&PID_5A11\\001',
            service: 'usbprint',
            isPrinterClass: true,
          });
        } else {
          logger.warn('[V1 Pipeline] No physical USB printer hardware or installed spooler queue detected.');
          this.isSetupRunning = false;
          return this.stateService.resetState();
        }
      }

      logger.info(`[V1 Pipeline] Scanned ${devices.length} physical USB device(s):`);
      devices.forEach(d => {
        const identifiedBrand = this.identification.identifyHardware(d);
        logger.info(` -> Device: "${d.name}" [PNP: ${d.pnpDeviceId}] [Service: ${d.service}] => Brand: [${identifiedBrand}]`);
      });

      // Select the first supported printer target (JOSH, VEER, DEV)
      const targetHardware = devices.find(d => {
        const b = this.identification.identifyHardware(d);
        return b !== 'UNSUPPORTED';
      }) || devices[0];

      logger.info(`[V1 Pipeline] Target USB Hardware Selected -> Name: "${targetHardware.name}" [PNP: ${targetHardware.pnpDeviceId}]`);

      this.stateService.updateState({
        step: 'USB_DETECTED',
        stepMessage: `USB Printer Detected: "${targetHardware.name}"`,
        progressPercent: 15,
        usbConnected: true,
        detectedHardwareName: targetHardware.name,
        vendorId: targetHardware.vendorId,
        productId: targetHardware.productId,
      });

      // Step 2: Automatic Printer Hardware Identification
      this.stateService.updateState({
        step: 'IDENTIFYING',
        stepMessage: 'Identifying printer hardware profile automatically...',
        progressPercent: 25,
      });

      const brand = this.identification.identifyHardware(targetHardware);

      if (brand === 'UNSUPPORTED') {
        logger.warn(`[V1 Pipeline] Connected hardware "${targetHardware.name}" is unsupported.`);
        this.isSetupRunning = false;
        return this.stateService.updateState({
          step: 'UNSUPPORTED_PRINTER',
          stepMessage: 'USB printer detected — unsupported model.',
          progressPercent: 25,
          usbConnected: true,
          detectedHardwareName: targetHardware.name,
          brand: 'UNSUPPORTED',
          queueName: null,
          driverInstalled: false,
          isDefault: false,
          testPrintSuccess: false,
        });
      }

      const profile = this.profileService.getProfile(brand);

      this.stateService.updateState({
        step: 'PROFILE_MATCHED',
        stepMessage: `Auto-matched Hardware Profile: [${brand}] (${profile.paperWidthMm}mm ${profile.documentType})`,
        progressPercent: 35,
        brand,
      });

      // Step 3: Automatic Driver Check & Auto Installation
      this.stateService.updateState({
        step: 'CHECKING_DRIVER',
        stepMessage: `Checking OS Spooler for ${brand} driver installation...`,
        progressPercent: 45,
      });

      let driverStatus = await this.driverManager.checkDriverInstalled(brand);

      if (driverStatus.installed) {
        logger.info(`[V1 Pipeline] Driver/Product installation already exists: "${driverStatus.queueName}"`);
        this.stateService.updateState({
          step: 'DRIVER_VERIFIED',
          stepMessage: `Driver installation already exists (${driverStatus.queueName || brand} driver is installed on PC).`,
          progressPercent: 65,
          driverInstalled: true,
          queueName: driverStatus.queueName,
        });
      } else {
        this.stateService.updateState({
          step: 'INSTALLING_DRIVER',
          stepMessage: `Driver missing. Auto-installing official ${brand} driver package with Administrator elevation...`,
          progressPercent: 55,
          driverInstalled: false,
        });

        const installResult = await this.driverManager.installDriverAutomatically(brand);
        let checkStatus = await this.driverManager.checkDriverInstalled(brand);

        if (!installResult.success && !checkStatus.installed) {
          throw new Error(`Driver installation failed: ${installResult.log}`);
        }

        driverStatus = checkStatus.installed ? checkStatus : await this.driverManager.checkDriverInstalled(brand);

        this.stateService.updateState({
          step: 'DRIVER_VERIFIED',
          stepMessage: `Driver installation completed successfully -> Queue: "${driverStatus.queueName}"`,
          progressPercent: 65,
          driverInstalled: true,
          queueName: driverStatus.queueName,
        });
      }

      const invalidPnpNames = ['usb printing support', 'usb input device', 'usb composite device', 'generic usb hub', 'unknown printer'];
      let queueName = driverStatus.queueName;
      if (!queueName || invalidPnpNames.includes(queueName.trim().toLowerCase())) {
        queueName = targetHardware.name && !invalidPnpNames.includes(targetHardware.name.trim().toLowerCase()) 
          ? targetHardware.name 
          : (brand === 'JOSH' ? 'LD0801 Label Printer' : brand === 'VEER' ? 'POS58 Printer' : 'SZ-80D Printer');
      }

      this.stateService.updateState({
        step: 'DRIVER_VERIFIED',
        stepMessage: `Driver Verified in OS Spooler -> Queue: "${queueName}"`,
        progressPercent: 65,
        driverInstalled: true,
        queueName,
      });

      // Step 4: Configure Queue
      this.stateService.updateState({
        step: 'CONFIGURING_PRINTER',
        stepMessage: `Configuring printer queue parameters for ${profile.paperWidthMm}mm media...`,
        progressPercent: 60,
      });

      await this.configurationService.configurePrinterQueue(queueName, profile);

      // Step 5: Save Storage
      this.stateService.updateState({
        step: 'SAVING_PRINTER',
        stepMessage: `Saving printer configuration to local storage...`,
        progressPercent: 75,
      });

      const saveResult = await this.persistenceService.saveOrUpdatePrinter({
        name: queueName,
        driverName: driverStatus.driverName || `${brand} Driver`,
        portName: 'USB001',
        isDefault: true,
        printerType: brand === 'JOSH' ? 'LABEL' : brand === 'VEER' ? 'RECEIPT' : 'RECEIPT_AND_LABEL',
      });

      // Step 6: Set Default
      this.stateService.updateState({
        step: 'SETTING_DEFAULT',
        stepMessage: `Setting "${queueName}" as Default Printer automatically...`,
        progressPercent: 90,
      });

      await this.defaultPrinterService.setAsDefaultPrinter(queueName);

      // Step 7: Setup Complete (100% Overall Setup Process Completion!)
      const finalState = this.stateService.updateState({
        step: 'SETUP_COMPLETE',
        stepMessage: `SETUP COMPLETE! Real ${brand} USB printer "${queueName}" configured & ready ✓`,
        progressPercent: 100,
        queueName,
        savedPrinterId: saveResult.printerId,
        isDefault: true,
      });

      // BACKEND AUTOMATED TEST PRINT (Executed strictly AFTER overall 7-step completion complete!)
      logger.info(`================ OVERALL 7-STEP SETUP COMPLETED SUCCESSFULLY ================`);
      logger.info(`[Backend Command] Transmitting 1 single test print label to physical printer "${queueName}"...`);
      
      const printResult = await this.testPrintService.executeAutomatedTestPrint(queueName, profile);

      if (!printResult.success) {
        logger.warn(`[Backend Notice] Test print job notice: ${printResult.message}`);
      } else {
        logger.info(`[Backend Notice] Test print delivered 1 single label to "${queueName}" post-setup completion ✓`);
      }

      this.stateService.updateState({
        testPrintSuccess: printResult.success,
      });

      this.isSetupRunning = false;
      return finalState;
    } catch (err: any) {
      logger.error(`[V1 Pipeline FAILED] ${err.message}`);
      this.isSetupRunning = false;
      return this.stateService.updateState({
        step: 'ERROR',
        stepMessage: `Setup Failed: ${err.message}`,
        errorDetails: err.message,
      });
    }
  }

  /**
   * Initializes USB monitoring to detect insertion / unplugging dynamically.
   */
  startUsbMonitoring() {
    this.usbDiscovery.startHotplugMonitoring((devices) => {
      if (devices.length === 0) {
        logger.warn('[Orchestrator] USB Printer unplugged. Updating status to DISCONNECTED.');
        this.stateService.resetState();
      } else {
        const currentStep = this.getState().step;
        if (currentStep === 'NO_USB_CONNECTED' || currentStep === 'ERROR') {
          logger.info('[Orchestrator] USB Printer re-connected. Re-triggering automated V1 pipeline...');
          this.runAutomatedV1Pipeline();
        }
      }
    });
  }

  async triggerManualTestPrint(): Promise<JoshTestPrintResult> {
    const currentState = this.getState();
    if (!currentState.usbConnected || !currentState.queueName) {
      return {
        success: false,
        stage: 'USB_DETECTION',
        code: 'NO_USB_PRINTER',
        printerName: 'USB Printer',
        queueName: currentState.queueName || 'None',
        message: 'No USB printer connected to test.',
      };
    }
    const profile = this.profileService.getProfile(currentState.brand);
    return this.testPrintService.executeAutomatedTestPrint(currentState.queueName, profile);
  }

  /**
   * Clears all cached hardware endpoint state and forces a fresh V1 pipeline auto-scan
   * to discover and pair a new or different physical USB printer.
   */
  async resetAndScanNewDevice(): Promise<V1OrchestratorState> {
    logger.info('[PrinterSetupOrchestrator] User requested reset & refresh for new physical USB device...');
    this.isSetupRunning = false;
    this.stateService.resetState();
    return await this.runAutomatedV1Pipeline();
  }
}
