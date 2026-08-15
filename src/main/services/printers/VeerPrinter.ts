import { PrinterProfile, VEER_PROFILE } from '../../../shared/types';
import { EscPosImageHelper } from '../commands/EscPosImageHelper';
import { sendRawBytesToPrinterQueue, sendRawBytesToWinRtBluetooth } from '../util/WinSpoolRawPrint';
import logger from '../../logger';

export class VeerPrinter {
  static readonly profile: PrinterProfile = VEER_PROFILE;

  static buildReceiptPayload(): Buffer {
    const dateStr = new Date().toLocaleDateString();
    const timeStr = new Date().toLocaleTimeString();

    const initCmd = Buffer.from('\x1B\x40\x1B\x61\x01', 'latin1'); // Init + Center
    const logoImageCmd = EscPosImageHelper.generateSeznikLogoRaster(384, 64);

    const textPayload =
      '\r\n\x1B\x61\x01' +
      'SEZNIK POS STORE\r\n' +
      '--------------------------------\r\n' +
      'VEER 58mm RECEIPT TEST\r\n' +
      '--------------------------------\r\n' +
      '\x1B\x61\x00' +
      `Date: ${dateStr}  ${timeStr}\r\n` +
      'Model: VEER Thermal POS58\r\n' +
      'Status: PHYSICAL PRINT VERIFIED\r\n' +
      '--------------------------------\r\n' +
      '\x1B\x61\x01' +
      'THANK YOU FOR USING SEZNIK!\r\n\r\n\r\n' +
      '\x1D\x56\x00';

    return Buffer.concat([initCmd, logoImageCmd, Buffer.from(textPayload, 'latin1')]);
  }

  static async printTestReceipt(target: { queueName?: string; macAddress?: string }): Promise<{ success: boolean; message: string }> {
    const payload = this.buildReceiptPayload();

    if (target.queueName) {
      logger.info(`[VEER] Printing test receipt to Windows Spooler Queue "${target.queueName}"...`);
      const res = await sendRawBytesToPrinterQueue(target.queueName, payload, 'VEER 58mm Test Receipt');
      if (res.success) return res;
    }

    if (target.macAddress) {
      logger.info(`[VEER] Printing test receipt via WinRT Bluetooth to MAC ${target.macAddress}...`);
      return sendRawBytesToWinRtBluetooth(target.macAddress, payload, 'VEER Bluetooth Receipt');
    }

    return { success: false, message: 'No printer queue or Bluetooth MAC specified for VEER.' };
  }
}
