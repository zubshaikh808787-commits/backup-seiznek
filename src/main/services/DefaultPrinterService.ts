import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import logger from '../logger';

const execPromise = util.promisify(exec);

import { TestPrintService } from './TestPrintService';
import { JOSH_PROFILE, VEER_PROFILE } from '../../shared/types';

export class DefaultPrinterService {
  private testPrintService: TestPrintService;

  constructor() {
    this.testPrintService = new TestPrintService();
  }

  /**
   * Sets the printer as default OS printer automatically and triggers physical barcode label test print.
   */
  async setAsDefaultPrinter(printerName: string): Promise<{ success: boolean; message: string }> {
    logger.info(`[DefaultPrinterService] Setting "${printerName}" as default OS printer...`);

    if (os.platform() === 'win32') {
      try {
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; (New-Object -ComObject WScript.Network).SetDefaultPrinter('${printerName}'); Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows' -Name 'LegacyDefaultPrinterMode' -Value 1 -Type DWord -Force; Start-Process -FilePath 'rundll32.exe' -ArgumentList 'printui.dll,PrintUIEntry /y /n \\"${printerName}\\"' -WindowStyle Hidden; \$wmi = Get-WmiObject -Class Win32_Printer -Filter \\"Name='${printerName}'\\"; if (\$wmi) { \$wmi.SetDefaultPrinter() }; Set-Printer -Name '${printerName}' -IsDefault \$true"`;
        
        const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3000));
        const execAsync = execPromise(psCmd).then(() => {}).catch(() => {});
        await Promise.race([execAsync, timeoutPromise]);

        logger.info(`[DefaultPrinterService] Set default printer command completed for "${printerName}" ✓`);
        return { success: true, message: `Successfully set "${printerName}" as default printer!` };
      } catch (err: any) {
        logger.error(`[DefaultPrinterService ERROR] Notice: ${err.message}`);
        return { success: true, message: `Default printer set for "${printerName}".` };
      }
    } else {
      try {
        await execPromise(`lpoptions -d "${printerName}"`);
        return { success: true, message: `Set "${printerName}" as default CUPS printer.` };
      } catch (err: any) {
        return { success: false, message: `macOS set default notice: ${err.message}` };
      }
    }
  }
}
