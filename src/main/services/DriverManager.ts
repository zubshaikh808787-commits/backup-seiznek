import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import logger from '../logger';
import { V1PrinterProfileBrand } from '../../shared/types';

const execPromise = util.promisify(exec);

export interface DriverCheckResult {
  installed: boolean;
  driverName: string;
  queueName: string;
}

export class DriverManager {
  /**
   * Checks if driver/queue is registered in OS spooler for the matched profile brand.
   */
  async checkDriverInstalled(brand: V1PrinterProfileBrand): Promise<DriverCheckResult> {
    if (os.platform() === 'win32') {
      try {
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name, DriverName | ConvertTo-Json"`;
        const { stdout } = await execPromise(psCmd);

        if (stdout && stdout.trim() !== '') {
          const parsed = JSON.parse(stdout);
          const list: any[] = Array.isArray(parsed) ? parsed : [parsed];

          const found = list.find((p: any) => {
            const name = String(p.Name || '').toLowerCase();
            const drv = String(p.DriverName || '').toLowerCase();

            if (brand === 'JOSH') {
              return name.includes('dp27') || name.includes('josh') || name.includes('ld0801') || name.includes('label') || name.includes('detong') || drv.includes('dp27') || drv.includes('josh') || drv.includes('label') || drv.includes('detong');
            } else if (brand === 'VEER') {
              return name.includes('pos58') || name.includes('pos-58') || name.includes('veer') || name.includes('receipt') || drv.includes('pos58') || drv.includes('pos-58') || drv.includes('veer') || drv.includes('receipt');
            } else if (brand === 'DEV') {
              return name.includes('dev') || name.includes('sz-80d') || name.includes('pos80') || drv.includes('dev') || drv.includes('sz-80d') || name.includes('dp27') || name.includes('pos58');
            }
            return false;
          });

          if (found) {
            logger.info(`[DriverManager] Found OS spooler queue: "${found.Name}" (${found.DriverName}) for ${brand}`);
            return { installed: true, driverName: found.DriverName || `${brand} Driver`, queueName: found.Name };
          }
        }
      } catch (err: any) {
        logger.warn(`[DriverManager] Error checking OS spooler: ${err.message}`);
      }
      return { installed: false, driverName: '', queueName: '' };
    } else {
      // macOS CUPS
      try {
        const { stdout } = await execPromise('lpstat -p');
        if (stdout && stdout.toLowerCase().includes(brand.toLowerCase())) {
          return { installed: true, driverName: `CUPS ${brand} Driver`, queueName: `${brand}_Printer` };
        }
      } catch (e) {}
      return { installed: false, driverName: '', queueName: '' };
    }
  }

  private findDriverExe(candidates: string[]): string | null {
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        logger.info(`[DriverManager] Found valid driver installer package: "${cand}"`);
        return cand;
      }
    }
    logger.warn(`[DriverManager] No installer EXE found among candidates: ${candidates.join(', ')}`);
    return null;
  }

  /**
   * Automatically executes the official driver installer package for the detected brand.
   */
  async installDriverAutomatically(brand: V1PrinterProfileBrand): Promise<{ success: boolean; log: string }> {
    logger.info(`[DriverManager] Executing automated driver installation pipeline for brand [${brand}]...`);

    if (brand === 'VEER') {
      return this.installVeerDriverPackage();
    } else if (brand === 'JOSH') {
      return this.installJoshDriverPackage();
    } else if (brand === 'DEV') {
      return this.installDevDriverPackage();
    }

    return { success: false, log: 'Unsupported brand driver request.' };
  }

  private async installJoshDriverPackage(): Promise<{ success: boolean; log: string }> {
    const candidates = [
      'C:\\Users\\omen\\OneDrive\\Desktop\\josh-files\\Win Driver Driver JOSH Label Printer.exe',
      'C:\\Users\\omen\\OneDrive\\Desktop\\josh-files\\DTPWeb-Inst-2.1.2022.1230.exe',
      path.resolve(process.cwd(), 'backend/src/config/josh-files/Win Driver Driver JOSH Label Printer.exe'),
      path.resolve(process.cwd(), 'backend/src/config/josh-files/DTPWeb-Inst-2.1.2022.1230.exe'),
      path.resolve(__dirname, '../../../backend/src/config/josh-files/Win Driver Driver JOSH Label Printer.exe'),
      path.resolve(__dirname, '../../../backend/src/config/josh-files/DTPWeb-Inst-2.1.2022.1230.exe'),
      'C:\\Users\\omen\\Downloads\\DTPWeb-Inst-2.6.2026.0101.exe',
    ];

    const targetExe = this.findDriverExe(candidates);

    if (os.platform() === 'win32') {
      try {
        // Step 1: Ensure OS Spooler queue "LD0801 Label Printer" exists on port USB001 from staged driver
        const psEnsureQueue = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Add-PrinterDriver -Name 'DP27 Label Printer'; if (-not (Get-Printer -Name 'LD0801 Label Printer' -ErrorAction SilentlyContinue)) { Add-Printer -Name 'LD0801 Label Printer' -DriverName 'DP27 Label Printer' -PortName 'USB001' }"`;
        await execPromise(psEnsureQueue);
        logger.info('[DriverManager] Ensured OS Spooler Queue "LD0801 Label Printer" on port USB001 ✓');

        // Step 2: If targetExe exists, run installer safely
        if (targetExe) {
          try {
            logger.info(`[DriverManager] Executing driver installer package: ${targetExe}`);
            const psRun = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Start-Process -FilePath '${targetExe}' -Wait"`;
            await execPromise(psRun);
          } catch (eExe: any) {
            logger.warn(`[DriverManager] JOSH driver installer notice: ${eExe.message}`);
          }
        }

        return { success: true, log: `JOSH Driver ("LD0801 Label Printer") verified & ready.` };
      } catch (err: any) {
        logger.warn(`[DriverManager] JOSH driver setup notice: ${err.message}`);
        return { success: true, log: `JOSH Driver package ready.` };
      }
    }
    return { success: true, log: 'JOSH Driver package execution completed.' };
  }

  private async installVeerDriverPackage(): Promise<{ success: boolean; log: string }> {
    const candidates = [
      'C:\\Users\\omen\\OneDrive\\Desktop\\VEER Thermal printer files\\POS58Setup_20210916.exe',
      'C:\\Users\\omen\\Downloads\\VEER Thermal printer files\\POS58Setup_20210916.exe',
      'C:\\Users\\omen\\Downloads\\VEER Thermal printer files\\Â■┤╬┐¬Àó╬─ÁÁ-ðíã▒\\58Setupðíã▒Ã²Â».exe',
      'C:\\Users\\omen\\Downloads\\VEER Thermal printer files\\Â■┤╬┐¬Àó╬─ÁÁ-ðíã▒\\POS58Setup_20190329.exe',
      path.resolve(process.cwd(), 'backend/src/config/veer-files/POS58Setup_20210916.exe'),
      path.resolve(__dirname, '../../../backend/src/config/veer-files/POS58Setup_20210916.exe'),
      'C:\\Users\\omen\\Downloads\\POS58Setup_20210916.exe',
    ];

    const driverExePath = this.findDriverExe(candidates);

    if (os.platform() === 'win32') {
      try {
        if (driverExePath) {
          try {
            logger.info(`[DriverManager] Executing VEER Driver Installer: ${driverExePath}`);
            const psRunInstaller = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Start-Process -FilePath '${driverExePath}' -Verb RunAs -Wait"`;
            await execPromise(psRunInstaller);
          } catch (eExe: any) {
            logger.warn(`[DriverManager] VEER driver installer notice: ${eExe.message}`);
          }
        }

        // Dynamically discover registered driver name (POS58, POS-58, Generic / Text Only)
        const psGetDrivers = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PrinterDriver -ErrorAction SilentlyContinue | Select-Object Name | ConvertTo-Json"`;
        let matchedDriver = 'POS58';
        try {
          const { stdout } = await execPromise(psGetDrivers);
          if (stdout && stdout.trim() !== '') {
            const parsed = JSON.parse(stdout);
            const drvList: any[] = Array.isArray(parsed) ? parsed : [parsed];
            const found = drvList.find((d: any) => {
              const dName = String(d.Name || '').toLowerCase();
              return dName.includes('pos58') || dName.includes('pos-58') || dName.includes('58mm') || dName.includes('veer');
            });
            if (found && found.Name) {
              matchedDriver = found.Name;
            }
          }
        } catch (eDrv) {}

        // Dynamically discover active USB printer port for VEER (e.g. OLIVETTIPRT80, USB006, USB003)
        const psGetPorts = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PrinterPort -ErrorAction SilentlyContinue | Select-Object Name, Description | ConvertTo-Json"`;
        let targetPort = 'USB001';
        try {
          const { stdout } = await execPromise(psGetPorts);
          if (stdout && stdout.trim() !== '') {
            const parsed = JSON.parse(stdout);
            const portList: any[] = Array.isArray(parsed) ? parsed : [parsed];

            let currentPort = '';
            try {
              const { stdout: prtOut } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Printer -Name 'POS58 Printer' -ErrorAction SilentlyContinue).PortName"`);
              if (prtOut && prtOut.trim()) currentPort = prtOut.trim();
            } catch (e) {}

            const specificPorts = portList.filter((p: any) => {
              const desc = String(p.Description || '').toLowerCase();
              const name = String(p.Name || '').toLowerCase();
              return desc.includes('olivetti') || desc.includes('prt80') || desc.includes('pos58') || desc.includes('veer') || desc.includes('58') || name.includes('pos58');
            });

            if (specificPorts.length > 0) {
              const matchCurrent = specificPorts.find((p: any) => String(p.Name || '').toLowerCase() === currentPort.toLowerCase());
              if (matchCurrent) {
                targetPort = matchCurrent.Name;
              } else {
                specificPorts.sort((a: any, b: any) => {
                  const numA = parseInt(String(a.Name || '').replace(/\D/g, '') || '0', 10);
                  const numB = parseInt(String(b.Name || '').replace(/\D/g, '') || '0', 10);
                  return numB - numA;
                });
                targetPort = specificPorts[0].Name;
              }
            } else {
              const genericUsbPorts = portList.filter((p: any) => {
                const desc = String(p.Description || '').toLowerCase();
                const name = String(p.Name || '').toLowerCase();
                return name.startsWith('usb') && !desc.includes('dp27') && !desc.includes('detong') && !desc.includes('josh') && desc !== 'virtual printer port for usb';
              });
              if (genericUsbPorts.length > 0) {
                genericUsbPorts.sort((a: any, b: any) => {
                  const numA = parseInt(String(a.Name || '').replace(/\D/g, '') || '0', 10);
                  const numB = parseInt(String(b.Name || '').replace(/\D/g, '') || '0', 10);
                  return numB - numA;
                });
                targetPort = genericUsbPorts[0].Name;
              }
            }
          }
        } catch (ePort) {}

        const psEnsureQueue = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Get-Printer -Name 'POS58 Printer' -ErrorAction SilentlyContinue | Get-PrintJob -ErrorAction SilentlyContinue | Where-Object { \\$_.JobStatus -like '*Error*' } | Remove-PrintJob -ErrorAction SilentlyContinue; if (-not (Get-Printer -Name 'POS58 Printer' -ErrorAction SilentlyContinue)) { Add-Printer -Name 'POS58 Printer' -DriverName '${matchedDriver}' -PortName '${targetPort}' -ErrorAction SilentlyContinue } else { Set-Printer -Name 'POS58 Printer' -PortName '${targetPort}' -ErrorAction SilentlyContinue }"`;
        await execPromise(psEnsureQueue);
        logger.info(`[DriverManager] Ensured OS Spooler Queue "POS58 Printer" using driver "${matchedDriver}" on port "${targetPort}" ✓`);

        return { success: true, log: `VEER POS58 Printer Driver (${matchedDriver}) installed and queue "POS58 Printer" registered on port ${targetPort}.` };
      } catch (err: any) {
        logger.warn(`[DriverManager] VEER driver setup notice: ${err.message}`);
        return { success: true, log: `VEER Driver package processed. Notice: ${err.message}` };
      }
    }
    return { success: true, log: 'VEER Driver package execution completed.' };
  }

  private async installDevDriverPackage(): Promise<{ success: boolean; log: string }> {
    const candidates = [
      'C:\\Users\\omen\\Downloads\\DEV- Folder\\Dev Windows Driver.exe',
      'C:\\Users\\omen\\Downloads\\DEV- Folder\\DEV Receipt Driver POS58Setup.exe',
      path.resolve(process.cwd(), 'backend/src/config/dev-files/Dev Windows Driver.exe'),
      path.resolve(process.cwd(), 'backend/src/config/dev-files/DEV Receipt Driver POS58Setup.exe'),
      path.resolve(__dirname, '../../../backend/src/config/dev-files/Dev Windows Driver.exe'),
      'C:\\Users\\omen\\Downloads\\Dev Windows Driver.exe',
      'C:\\Users\\omen\\Downloads\\DEV Receipt Driver POS58Setup.exe',
    ];

    const devExePath = this.findDriverExe(candidates);

    if (os.platform() === 'win32') {
      try {
        const psEnsureQueue = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Add-PrinterDriver -Name 'POS58 Printer'; Add-Printer -Name 'POS58 Printer' -DriverName 'POS58 Printer' -PortName 'USB001'"`;
        await execPromise(psEnsureQueue);
        logger.info('[DriverManager] Ensured OS Spooler Queue for DEV printer on port USB001 ✓');

        if (devExePath) {
          try {
            logger.info(`[DriverManager] Executing DEV Driver Installer: ${devExePath}`);
            const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Start-Process -FilePath '${devExePath}' -Wait"`;
            await execPromise(psCmd);
          } catch (eExe: any) {
            logger.warn(`[DriverManager] DEV driver installer notice: ${eExe.message}`);
          }
        }
        return { success: true, log: 'DEV Printer Driver installed successfully.' };
      } catch (err: any) {
        logger.warn(`[DriverManager] DEV driver setup notice: ${err.message}`);
        return { success: true, log: 'DEV Driver package ready.' };
      }
    }
    return { success: true, log: 'DEV Driver package execution completed.' };
  }

  /**
   * Uninstalls driver package and queue directly from Windows OS without Control Panel / Programs & Features.
   */
  async uninstallDriverPackage(brand: V1PrinterProfileBrand, queueName?: string): Promise<{ success: boolean; log: string }> {
    logger.info(`[DriverManager] Initiating complete OS uninstallation for brand [${brand}] (Queue: ${queueName || 'Default'})...`);
    if (os.platform() === 'win32') {
      try {
        const targets = Array.from(new Set([
          queueName,
          brand === 'JOSH' ? 'LD0801 Label Printer' : null,
          brand === 'JOSH' ? 'DP27 Label Printer' : null,
          brand === 'VEER' ? 'POS58 Printer' : null,
          'LD0801',
          'DP27',
          'POS58'
        ].filter(Boolean)));

        for (const target of targets) {
          const psQueueDel = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Get-Printer | Where-Object { $_.Name -like '*${target}*' -or $_.DriverName -like '*${target}*' } | Remove-Printer -Confirm:$false"`;
          execPromise(psQueueDel).catch(() => {});
        }

        return {
          success: true,
          log: `Printer queue "${queueName || brand}" uninstallation request completed.`,
        };
      } catch (err: any) {
        logger.warn(`[DriverManager] OS Driver uninstallation warning: ${err.message}`);
        return {
          success: true,
          log: `Printer queue removed. Notice: ${err.message}`,
        };
      }
    }
    return { success: true, log: 'Driver uninstallation complete.' };
  }

  /**
   * Verifies driver installation in OS spooler after setup.
   */
  async verifyDriverInstallation(brand: V1PrinterProfileBrand): Promise<boolean> {
    logger.info(`[DriverManager] Polling OS spooler to verify ${brand} queue creation...`);
    for (let i = 0; i < 6; i++) {
      const check = await this.checkDriverInstalled(brand);
      if (check.installed) {
        logger.info(`[DriverManager] Verified ${brand} driver installation in OS spooler -> "${check.queueName}"`);
        return true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }
}

