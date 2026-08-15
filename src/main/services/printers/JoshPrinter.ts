import { PrinterProfile, JOSH_PROFILE } from '../../../shared/types';
import { DtpWebSdkWrapper } from '../sdk/dtpweb';
import { sendRawBytesToWinRtBluetooth, sendRawBytesToPrinterQueue } from '../util/WinSpoolRawPrint';
import logger from '../../logger';

export class JoshPrinter {
  static readonly profile: PrinterProfile = JOSH_PROFILE;
  private static dtpWeb = new DtpWebSdkWrapper();

  /**
   * Generates raw TSPL (TSC / DeTong Page Description Language) commands for a 50x50mm Thermal Label.
   */
  static buildTsplTestLabel(): Buffer {
    const dateStr = new Date().toLocaleDateString();
    const timeStr = new Date().toLocaleTimeString();

    const tsplCommands =
      'SIZE 50 mm, 50 mm\r\n' +
      'GAP 3 mm, 0 mm\r\n' +
      'DIRECTION 1\r\n' +
      'CLS\r\n' +
      'BOX 16,16,384,384,3\r\n' +
      'TEXT 200,30,"TSS24.BF2",0,2,2,"SEZNIK STORE"\r\n' +
      'TEXT 200,75,"TSS24.BF2",0,1,1,"JOSH 50x50mm LABEL"\r\n' +
      'TEXT 200,105,"0",0,1,1,"-----------------------------"\r\n' +
      `TEXT 40,130,"TSS24.BF2",0,1,1,"DATE: ${dateStr}"\r\n` +
      `TEXT 40,160,"TSS24.BF2",0,1,1,"TIME: ${timeStr}"\r\n` +
      'TEXT 40,190,"TSS24.BF2",0,1,1,"LINK: BLE / USB ACTIVE"\r\n' +
      'TEXT 40,220,"TSS24.BF2",0,1,1,"STATUS: TSPL VERIFIED"\r\n' +
      'BARCODE 50,260,"128",60,1,0,2,2,"SEZNIK-JOSH"\r\n' +
      'TEXT 200,345,"0",0,1,1,"* SEZNIK-JOSH *"\r\n' +
      'PRINT 1,1\r\n';

    return Buffer.from(tsplCommands, 'ascii');
  }

  /**
   * Prints the official JOSH 50x50mm label via the DTPWeb SDK if available, or direct Spooler/WinRT fallback.
   */
  static async printTestLabel(target: { queueName?: string; macAddress?: string }): Promise<{ success: boolean; message: string }> {
    logger.info(`[JOSH] Initiating test label print for target: Queue="${target.queueName || 'N/A'}", MAC="${target.macAddress || 'N/A'}"...`);

    // 1. Try DTPWeb SDK if queue name is provided
    if (target.queueName) {
      const dtpCheck = await this.dtpWeb.checkPlugin();
      if (dtpCheck.running) {
        logger.info(`[JOSH] DTPWeb service active. Sending 50x50mm label via DTPWeb SDK...`);
        const dtpResult = await this.dtpWeb.printJoshTestLabel(target.queueName);
        if (dtpResult.success) {
          return dtpResult;
        }
        logger.warn(`[JOSH] DTPWeb SDK print failed: ${dtpResult.message}. Falling back to WinSpool RAW.`);
      }
    }

    const tsplPayload = this.buildTsplTestLabel();

    // 2. Try Windows Print Spooler RAW if queue name exists
    if (target.queueName) {
      logger.info(`[JOSH] Sending raw TSPL commands (${tsplPayload.length} bytes) to Windows Queue "${target.queueName}"...`);
      const spoolRes = await sendRawBytesToPrinterQueue(target.queueName, tsplPayload, 'JOSH 50x50mm Test Label');
      if (spoolRes.success) {
        return spoolRes;
      }
    }

    // 3. Try Direct WinRT Bluetooth RFCOMM if MAC address is provided
    if (target.macAddress) {
      logger.info(`[JOSH] Streaming raw TSPL commands directly via WinRT Bluetooth RFCOMM to MAC ${target.macAddress}...`);
      return sendRawBytesToWinRtBluetooth(target.macAddress, tsplPayload, 'JOSH BLE Test Label');
    }

    return {
      success: false,
      message: 'No valid Windows printer queue or Bluetooth MAC address available to print JOSH test label.',
    };
  }
}
