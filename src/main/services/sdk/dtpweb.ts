/**
 * DothanTech DTPWeb PC Web SDK Adapter (v2.1.2022.1230)
 * 
 * ARCHITECTURAL NOTICE:
 * The DTPWeb SDK defines LPA_DeviceType as:
 * - Local = 1 (Printers registered in Windows Print Spooler)
 * - Net = 2 (Network shared printers)
 * - Wifi = 3 (Standalone WiFi IP printers)
 * 
 * DTPWeb does NOT have a native Bluetooth / BLE discovery engine.
 * Therefore:
 * 1. Bluetooth BLE / SPP discovery and GATT connection are handled by our dedicated Windows BLE layer (JoshBleManager).
 * 2. When the JOSH printer queue is registered in Windows Spooler on its Bluetooth port, DTPWeb accesses it as LPA_DeviceType.Local (Type 1).
 * 3. We use DTPWeb SDK for local label layout rendering, barcode generation, and spooler submission.
 */

import http from 'http';
import logger from '../../logger';

export const DTPWEB_CONFIG = {
  DEFAULT_HOST: '127.0.0.1',
  PRIMARY_PORT: 37989,
  SECONDARY_PORT: 37988,
  TIMEOUT_MS: 4000,
};

export interface DtpWebDevice {
  type: number; // 1 = Local, 2 = Net, 3 = Wifi
  name: string;
  ip?: string;
  port?: number;
  hostname?: string;
}

export class DtpWebSdkWrapper {
  private activePort: number = DTPWEB_CONFIG.PRIMARY_PORT;
  private isConnected: boolean = false;

  private async request(action: string, data: Record<string, any> = {}, port?: number): Promise<any> {
    const targetPort = port || this.activePort;
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const req = http.request(
        {
          hostname: DTPWEB_CONFIG.DEFAULT_HOST,
          port: targetPort,
          path: `/lpapi/${action}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: DTPWEB_CONFIG.TIMEOUT_MS,
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const parsed = JSON.parse(body);
                resolve(parsed);
              } else {
                reject(new Error(`DTPWeb returned HTTP status ${res.statusCode}`));
              }
            } catch (err: any) {
              reject(new Error(`Failed to parse DTPWeb response: ${err.message}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`DTPWeb request timeout (${DTPWEB_CONFIG.TIMEOUT_MS}ms) on port ${targetPort}`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Checks if the DTPWeb Print Assistant background Windows service is alive.
   */
  async checkPlugin(): Promise<{ running: boolean; port: number; message: string }> {
    // Try primary port 37989
    try {
      await this.request('ServerInfo', {}, DTPWEB_CONFIG.PRIMARY_PORT);
      this.activePort = DTPWEB_CONFIG.PRIMARY_PORT;
      this.isConnected = true;
      logger.info(`[DTPWeb SDK] DTPWeb service is running on primary port ${this.activePort} ✓`);
      return { running: true, port: this.activePort, message: 'DTPWeb service active on port 37989' };
    } catch {
      // Try secondary port 37988
      try {
        await this.request('ServerInfo', {}, DTPWEB_CONFIG.SECONDARY_PORT);
        this.activePort = DTPWEB_CONFIG.SECONDARY_PORT;
        this.isConnected = true;
        logger.info(`[DTPWeb SDK] DTPWeb service is running on secondary port ${this.activePort} ✓`);
        return { running: true, port: this.activePort, message: 'DTPWeb service active on port 37988' };
      } catch (err: any) {
        this.isConnected = false;
        logger.warn(`[DTPWeb SDK] DTPWeb service is not running on localhost (37989/37988): ${err.message}`);
        return { running: false, port: 0, message: 'DTPWeb Windows service is not running.' };
      }
    }
  }

  /**
   * Retrieves registered local printers known to DTPWeb.
   */
  async getPrinters(options: { onlyOnline?: boolean; onlyLocal?: boolean; onlySupported?: boolean } = {}): Promise<DtpWebDevice[]> {
    const isAlive = await this.checkPlugin();
    if (!isAlive.running) return [];

    try {
      const res = await this.request('GetPrinters', {
        onlyOnline: options.onlyOnline !== false,
        onlyLocal: options.onlyLocal !== false,
        onlySupported: options.onlySupported !== false,
      });

      const list: DtpWebDevice[] = Array.isArray(res?.resultInfo) ? res.resultInfo : (Array.isArray(res) ? res : []);
      logger.info(`[DTPWeb SDK] getPrinters() returned ${list.length} printer(s) from DTPWeb service.`);
      return list;
    } catch (err: any) {
      logger.error(`[DTPWeb SDK] getPrinters() failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Opens target printer by name.
   */
  async openPrinter(printerName: string): Promise<boolean> {
    try {
      const res = await this.request('OpenPrinter', { printerName });
      const success = res?.statusCode === 0 || res?.resultInfo === true || res === true;
      logger.info(`[DTPWeb SDK] openPrinter("${printerName}") -> ${success ? 'SUCCESS' : 'FAILED'}`);
      return success;
    } catch (err: any) {
      logger.error(`[DTPWeb SDK] openPrinter error: ${err.message}`);
      return false;
    }
  }

  /**
   * Closes currently open printer.
   */
  async closePrinter(): Promise<boolean> {
    try {
      const res = await this.request('ClosePrinter', {});
      return res?.statusCode === 0 || res === true;
    } catch {
      return false;
    }
  }

  /**
   * Prints a full 50x50mm JOSH Barcode Label using real DTPWeb drawing APIs.
   */
  async printJoshTestLabel(printerName: string): Promise<{ success: boolean; message: string }> {
    const isAlive = await this.checkPlugin();
    if (!isAlive.running) {
      return { success: false, message: 'DTPWeb Print Service is not running on localhost.' };
    }

    try {
      const opened = await this.openPrinter(printerName);
      if (!opened) {
        return { success: false, message: `Could not open printer "${printerName}" via DTPWeb SDK.` };
      }

      // 1. Start Job: 50mm x 50mm label
      await this.request('StartJob', { width: 50, height: 50, orientation: 0, jobName: 'SEZNIK JOSH 50x50' });

      // 2. Start Page
      await this.request('StartPage', {});

      // 3. Draw Header Text
      await this.request('DrawText', {
        text: 'SEZNIK POS STORE',
        x: 2,
        y: 3,
        width: 46,
        height: 6,
        fontHeight: 4,
        fontStyle: 1, // Bold
        horizontalAlignment: 1, // Center
      });

      // 4. Draw Subtitle
      await this.request('DrawText', {
        text: 'JOSH 50x50mm TEST LABEL',
        x: 2,
        y: 10,
        width: 46,
        height: 5,
        fontHeight: 3,
        horizontalAlignment: 1,
      });

      // 5. Draw Details
      const dateStr = new Date().toLocaleDateString();
      await this.request('DrawText', {
        text: `DATE: ${dateStr}`,
        x: 4,
        y: 16,
        width: 42,
        fontHeight: 2.8,
      });

      await this.request('DrawText', {
        text: 'STATUS: BLE / USB VERIFIED',
        x: 4,
        y: 20,
        width: 42,
        fontHeight: 2.8,
      });

      // 6. Draw 1D Barcode (Code 128)
      await this.request('Draw1DBarcode', {
        text: 'SEZNIK-JOSH-50',
        x: 5,
        y: 25,
        width: 40,
        height: 14,
        textHeight: 3,
        type: 28, // Code 128
        textAlignment: 1, // Center
      });

      // 7. End Page
      await this.request('EndPage', {});

      // 8. Commit Job
      const commitRes = await this.request('CommitJob', { copies: 1 });
      await this.closePrinter();

      const success = commitRes?.statusCode === 0 || commitRes === true;
      logger.info(`[DTPWeb SDK] JOSH 50x50mm Test Label committed to "${printerName}" -> ${success ? 'SUCCESS' : 'FAILED'}`);
      return {
        success,
        message: success
          ? `JOSH 50x50mm test label printed to "${printerName}" via DTPWeb SDK ✓`
          : 'DTPWeb CommitJob failed.',
      };
    } catch (err: any) {
      logger.error(`[DTPWeb SDK] Test label print exception: ${err.message}`);
      return { success: false, message: `DTPWeb print error: ${err.message}` };
    }
  }
}
