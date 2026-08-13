import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../../logger';
import { UsbPrinterTransport } from './UsbPrinterTransport';
import { DetectedPrinter, PrintResult, V1PrinterProfileBrand } from '../../../shared/types';
import { PrinterCommandGenerator } from '../commands/PrinterCommandGenerator';

const execPromise = util.promisify(exec);

export class MacUsbTransport implements UsbPrinterTransport {
  private activeConnections: Set<string> = new Set();

  async discover(): Promise<DetectedPrinter[]> {
    if (os.platform() !== 'darwin') return [];

    logger.info('[MacUsbTransport] Querying macOS CUPS Printers via lpstat...');
    const detected: DetectedPrinter[] = [];

    try {
      const { stdout } = await execPromise('lpstat -p -v');
      if (stdout && stdout.trim() !== '') {
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.startsWith('printer ')) {
            const parts = line.split(' ');
            const queueName = parts[1];
            const lower = queueName.toLowerCase();

            let brand: V1PrinterProfileBrand = 'UNSUPPORTED';
            if (lower.includes('pos58') || lower.includes('pos-58') || lower.includes('veer') || lower.includes('receipt')) {
              brand = 'VEER';
            } else if (lower.includes('dp27') || lower.includes('josh') || lower.includes('ld0801') || lower.includes('label')) {
              brand = 'JOSH';
            } else if (lower.includes('dev') || lower.includes('sz-80d') || lower.includes('pos80')) {
              brand = 'DEV';
            }

            if (brand !== 'UNSUPPORTED') {
              detected.push({
                printerId: `mac-${queueName.toLowerCase()}`,
                brand,
                name: queueName,
                queueName,
                portName: 'CUPS_USB',
                driverName: `CUPS ${brand} Driver`,
                isReady: !line.includes('disabled'),
                platform: 'darwin',
              });
            }
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[MacUsbTransport] Discovery notice: ${err.message}`);
    }

    return detected;
  }

  async connect(printerId: string): Promise<void> {
    logger.info(`[MacUsbTransport] Connecting handle to macOS printer queue: "${printerId}"`);
    this.activeConnections.add(printerId);
  }

  async disconnect(printerId: string): Promise<void> {
    logger.info(`[MacUsbTransport] Disconnecting handle for macOS printer: "${printerId}"`);
    this.activeConnections.delete(printerId);
  }

  async isReady(printerId: string): Promise<boolean> {
    const printers = await this.discover();
    const found = printers.find(p => p.printerId === printerId || p.queueName.toLowerCase() === printerId.toLowerCase());
    return found ? found.isReady : false;
  }

  async write(printerId: string, data: Buffer): Promise<PrintResult> {
    logger.info(`[MacUsbTransport] Write invoked for macOS printer: "${printerId}" (${data.length} bytes)`);

    const printers = await this.discover();
    const matched = printers.find(p => p.printerId === printerId || p.queueName.toLowerCase() === printerId.toLowerCase());
    const queueName = matched ? matched.queueName : (printerId.includes('POS58') || printerId.includes('VEER') ? 'VEER_POS58_Printer' : 'JOSH_DP27_Printer');

    try {
      const tempFile = path.join(os.tmpdir(), `seznik_mac_print_${Date.now()}.bin`);
      fs.writeFileSync(tempFile, data);

      const lprCmd = `lpr -P "${queueName}" -o raw "${tempFile}"`;
      await execPromise(lprCmd);

      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}

      logger.info(`[MacUsbTransport] Payload (${data.length} bytes) sent to CUPS queue "${queueName}" ✓`);

      return {
        success: true,
        printerId,
        platform: 'darwin',
        queueName,
        portName: 'CUPS_USB',
        bytesSent: data.length,
      };
    } catch (err: any) {
      logger.error(`[MacUsbTransport ERROR] Write failed for "${queueName}": ${err.message}`);
      return {
        success: false,
        printerId,
        platform: 'darwin',
        queueName,
        portName: 'CUPS_USB',
        bytesSent: 0,
        errorCode: 'USB_WRITE_FAILED',
        errorMessage: err.message,
      };
    }
  }

  async testPrint(printerId: string): Promise<PrintResult> {
    logger.info(`[MacUsbTransport] Executing test print for: "${printerId}"`);
    const brand: V1PrinterProfileBrand = printerId.toLowerCase().includes('pos58') || printerId.toLowerCase().includes('veer') ? 'VEER' : 'JOSH';
    const payload = PrinterCommandGenerator.generateTestPayload(brand);
    return this.write(printerId, payload);
  }
}
