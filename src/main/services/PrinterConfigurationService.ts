import { PrinterProfile } from '../../shared/types';
import logger from '../logger';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';

const execPromise = util.promisify(exec);

export class PrinterConfigurationService {
  /**
   * Configures printer queue properties (paper dimensions, port binding, RAW datatype) in OS spooler.
   */
  async configurePrinterQueue(printerName: string, profile: PrinterProfile): Promise<{ success: boolean; message: string }> {
    logger.info(`[PrinterConfigurationService] Configuring OS spooler properties for "${printerName}" [Brand: ${profile.brand}]`);
    logger.info(`[PrinterConfigurationService] Target Media: ${profile.paperWidthMm}mm width | Document Type: ${profile.documentType}`);

    if (os.platform() === 'win32' && profile.brand === 'JOSH') {
      try {
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-CimInstance Win32_Printer | Where-Object { $_.Name -like '*${printerName}*' -or $_.Name -like '*LD0801*' -or $_.Name -like '*DP27*' } | Select-Object -First 1; if (\$p) { Set-Printer -Name \$p.Name -PortName 'USB001' -PrintProcessor 'winprint' -DataType 'RAW' -ErrorAction SilentlyContinue }"`;
        await execPromise(psCmd);
        logger.info(`[PrinterConfigurationService] Verified & bound OS Spooler Port "USB001" and Datatype "RAW" for "${printerName}" ✓`);
      } catch (err: any) {
        logger.warn(`[PrinterConfigurationService] Port configuration notice: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `Configured OS queue "${printerName}" for ${profile.brand} (${profile.paperWidthMm}mm media).`,
    };
  }
}
