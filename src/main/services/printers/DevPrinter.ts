import { PrinterProfile, DEV_PROFILE } from '../../../shared/types';
import { sendRawBytesToPrinterQueue } from '../util/WinSpoolRawPrint';
import logger from '../../logger';

export class DevPrinter {
  static readonly profile: PrinterProfile = DEV_PROFILE;

  static buildDualModePayload(): Buffer {
    const dateStr = new Date().toLocaleDateString();
    const payload =
      '\x1B\x40' +
      '\x1B\x61\x01' +
      'SEZNIK POS STORE\r\n' +
      '================================\r\n' +
      'DEV 80mm DUAL-MODE TEST\r\n' +
      '================================\r\n' +
      '\x1B\x61\x00' +
      `Date: ${dateStr}\r\n` +
      'Hardware: SZ-80D Dual-Mode Thermal\r\n' +
      'Status: VERIFIED\r\n' +
      '================================\r\n\r\n\r\n' +
      '\x1D\x56\x00';

    return Buffer.from(payload, 'latin1');
  }

  static async printTest(queueName: string): Promise<{ success: boolean; message: string }> {
    logger.info(`[DEV] Printing dual-mode test to Windows Spooler Queue "${queueName}"...`);
    const payload = this.buildDualModePayload();
    return sendRawBytesToPrinterQueue(queueName, payload, 'DEV 80mm Test Print');
  }
}
