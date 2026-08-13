import logger from '../logger';
import path from 'path';
import fs from 'fs';

const vendorPath = path.resolve(__dirname, './vendor/dtpweb.js');
let DTPWeb: any = null;

try {
  if (fs.existsSync(vendorPath)) {
    DTPWeb = require(vendorPath).DTPWeb;
  } else {
    DTPWeb = require(path.resolve(__dirname, '../../../scratch/josh_sdk/PC Web SDK (Include API document)/lib/dtpweb.js')).DTPWeb;
  }
} catch (err: any) {
  logger.warn(`[DtpWebService] Vendor dtpweb.js require warning: ${err.message}`);
}

export class DtpWebService {
  private api: any = null;

  constructor() {
    if (DTPWeb) {
      try {
        this.api = DTPWeb.getInstance();
      } catch (e: any) {
        logger.error(`[DtpWebService] Failed to initialize DTPWeb instance: ${e.message}`);
      }
    }
  }

  /**
   * Checks if local DtpWeb Print Assistant service is running on 127.0.0.1:15216 / 35216
   */
  async checkPlugin(): Promise<{ running: boolean; message: string }> {
    if (!this.api) {
      return {
        running: false,
        message: 'DtpWeb SDK not initialized. Please ensure DTPWeb-Inst-2.1.2022.1230.exe is installed.',
      };
    }

    return new Promise((resolve) => {
      try {
        this.api.checkPlugin((running: boolean) => {
          if (running) {
            logger.info('[DtpWebService] DtpWeb Print Assistant Service is RUNNING on 127.0.0.1:15216 ✓');
            resolve({
              running: true,
              message: 'DtpWeb Print Assistant Service active at 127.0.0.1:15216 ✓',
            });
          } else {
            logger.warn('[DtpWebService] DtpWeb Print Assistant Service is NOT running on 127.0.0.1:15216.');
            resolve({
              running: false,
              message: 'DtpWeb Print Assistant background service not detected. Please run DTPWeb-Inst-2.1.2022.1230.exe.',
            });
          }
        });
      } catch (err: any) {
        logger.error(`[DtpWebService] checkPlugin exception: ${err.message}`);
        resolve({
          running: false,
          message: `DtpWeb checkPlugin error: ${err.message}`,
        });
      }
    });
  }

  /**
   * Enumerates installed printers detected by local DtpWeb service
   */
  async getPrinters(): Promise<{ success: boolean; printers: any[]; message: string }> {
    if (!this.api) {
      return { success: false, printers: [], message: 'DtpWeb SDK uninitialized.' };
    }

    try {
      const items = await this.api.getPrinters({ onlyLocal: true });
      if (items && Array.isArray(items) && items.length > 0) {
        logger.info(`[DtpWebService] Discovered ${items.length} printer(s) via DtpWeb service.`);
        return {
          success: true,
          printers: items,
          message: `Discovered ${items.length} printer(s) via DtpWeb Print Assistant.`,
        };
      }
      return {
        success: false,
        printers: [],
        message: 'No local printers detected by DtpWeb service. Ensure printer is connected via USB.',
      };
    } catch (err: any) {
      logger.error(`[DtpWebService] getPrinters exception: ${err.message}`);
      return {
        success: false,
        printers: [],
        message: `DtpWeb getPrinters error: ${err.message}`,
      };
    }
  }

  /**
   * Executes official vendor print job (openPrinter -> startJob -> drawText -> draw1DBarcode -> commitJob -> closePrinter)
   * Label size: 50mm x 50mm
   */
  async printTestLabel(printerName?: string): Promise<{ success: boolean; message: string; reason?: string }> {
    logger.info(`[JOSH-AUTO-1] Automatic vendor test print started`);

    if (!this.api) {
      logger.error(`[JOSH-AUTO-9] Actual DtpWebService error = SDK_UNINITIALIZED`);
      return { success: false, message: 'DtpWeb SDK uninitialized.', reason: 'SDK_UNINITIALIZED' };
    }

    try {
      // Ensure English Windows compatible font name
      this.api.setFontName('Arial');

      // Ensure clean state before opening
      try { await this.api.closePrinter(); } catch (e) {}

      const printersList: any[] = await this.api.getPrinters({ onlyOnline: false });
      if (!printersList || printersList.length === 0) {
        logger.error(`[JOSH-AUTO-9] Actual DtpWebService error = NO_PRINTERS_FOUND`);
        return {
          success: false,
          message: 'Cannot print: No installed printers detected by DtpWeb service.',
          reason: 'NO_PRINTERS_FOUND',
        };
      }

      let targetDevice = printersList[0];
      if (printerName) {
        const found = printersList.find(p => 
          (p.printerName || p.name || '').toLowerCase().includes(printerName.toLowerCase()) ||
          printerName.toLowerCase().includes((p.printerName || p.name || '').toLowerCase())
        );
        if (found) targetDevice = found;
      }

      // Clone device object and remove network IP override so DtpWeb routes via local loopback 127.0.0.1:15216
      const deviceToOpen: any = { ...targetDevice };
      delete deviceToOpen.ip;

      const targetName = printerName || targetDevice.printerName || targetDevice.name || 'LD0801 Label Printer';
      
      // Enforce Type 9 (Windows Spooler Mode) with Windows Printer Queue Name
      deviceToOpen.type = 9;
      deviceToOpen.name = targetName;
      deviceToOpen.printerName = targetName;
      deviceToOpen.driver = 'DP27 Label Printer';
      deviceToOpen.devicePort = 'USB001';

      logger.info(`[JOSH-AUTO-3] Target Printer Device Object -> Name: "${deviceToOpen.name}", Queue: "${targetName}"`);

      const opened = await this.api.openPrinter(deviceToOpen);
      if (!opened) {
        logger.error(`[JOSH-AUTO-9] Actual DtpWebService error = OPEN_PRINTER_FAILED for "${targetName}"`);
        return {
          success: false,
          message: `Failed to open printer "${targetName}" via DtpWeb service.`,
          reason: 'OPEN_PRINTER_FAILED',
        };
      }

      logger.info(`[DtpWebService] Printer "${targetName}" opened successfully. Starting print job...`);
      const width = 50;
      const height = 50;
      const jobStarted = await this.api.startJob({ width, height, orientation: 0, jobName: 'SEZNIK 50x50 Test Label' });

      if (!jobStarted) {
        await this.api.closePrinter();
        logger.error(`[JOSH-AUTO-9] Actual DtpWebService error = START_JOB_FAILED for "${targetName}"`);
        return {
          success: false,
          message: `startJob failed for "${targetName}".`,
          reason: 'START_JOB_FAILED',
        };
      }

      // Initialize page frame
      await this.api.startPage();

      // Draw 50mm x 50mm text and barcode 12345678 using vendor API with Arial font
      await this.api.drawText({ text: 'SEZNIK JOSH 50x50mm', x: 4, y: 4, fontHeight: 3.5, fontName: 'Arial' });
      await this.api.draw1DBarcode({ text: '12345678', x: 4, y: 12, width: 42, height: 25, textHeight: 4, fontName: 'Arial' });

      // Finalize page frame
      await this.api.endPage();

      logger.info(`[JOSH-AUTO-4] Payload prepared -> 50mm x 50mm TSPL (text + CODE128: 12345678)`);
      logger.info(`[JOSH-AUTO-6] Calling commitJob()`);

      const commitSuccess = await this.api.commitJob();
      await this.api.closePrinter();

      logger.info(`[JOSH-AUTO-7] commitJob result = ${commitSuccess}`);

      if (commitSuccess) {
        logger.info(`[DtpWebService] Official DtpWeb Vendor Print Job committed & printed successfully ✓`);
        return {
          success: true,
          message: `Official JOSH Test Label committed & printed successfully to "${targetName}" ✓`,
        };
      } else {
        logger.error(`[JOSH-AUTO-9] commitJob returned false`);
        return {
          success: false,
          message: `Print job commit failed on printer "${targetName}".`,
          reason: 'COMMIT_JOB_FAILED',
        };
      }
    } catch (err: any) {
      logger.error(`[JOSH-AUTO-9] Actual DtpWebService error = EXCEPTION: ${err.message}`);
      if (this.api) {
        try { await this.api.closePrinter(); } catch {}
      }
      return {
        success: false,
        message: `DtpWeb print exception: ${err.message}`,
        reason: 'EXCEPTION',
      };
    }
  }
}
