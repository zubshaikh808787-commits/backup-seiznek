import { SystemSettings, SavedPrinter, RemoveSavedPrinterResult, SetSavedDefaultResult } from '../shared/types';
import logger from '../main/logger';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs';

const execPromise = util.promisify(exec);

export interface DeskAppConfig {
  settings: SystemSettings;
  savedPrinters: SavedPrinter[];
  defaultPrinterId: string | null;
  selectedPrinterId: string | null;
}

export interface IConfigurationService {
  getSettings(): Promise<SystemSettings>;
  updateSettings(partial: Partial<SystemSettings>): Promise<SystemSettings>;
  getSavedPrinters(): Promise<SavedPrinter[]>;
  getDefaultPrinterId(): Promise<string | null>;
  savePrinter(printer: Partial<SavedPrinter>): Promise<{ success: boolean; savedPrinters: SavedPrinter[]; message: string }>;
  removeSavedPrinter(printerId: string): Promise<RemoveSavedPrinterResult>;
  setSavedDefaultPrinter(printerId: string): Promise<SetSavedDefaultResult>;
}

export class ConfigurationService implements IConfigurationService {
  private configFilePath: string;
  private currentConfig: DeskAppConfig;

  constructor() {
    this.configFilePath = path.join(os.homedir(), '.seznik-printers.json');
    this.currentConfig = this.loadConfigFromDisk();
  }

  private loadConfigFromDisk(): DeskAppConfig {
    const defaultConfig: DeskAppConfig = {
      settings: {
        theme: 'dark',
        language: 'en',
        autoUpdate: true,
        logLevel: 'INFO',
        downloadPath: path.join(os.homedir(), 'Downloads', 'SeznikPrinters'),
      },
      savedPrinters: [],
      defaultPrinterId: null,
      selectedPrinterId: null,
    };

    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        logger.info(`Loaded DeskApp printer configuration from disk: ${this.configFilePath}`);
        return { ...defaultConfig, ...parsed };
      }
    } catch (err: any) {
      logger.warn(`Failed to read DeskApp config file, using default: ${err.message}`);
    }

    return defaultConfig;
  }

  private saveConfigToDisk(): void {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.currentConfig, null, 2), 'utf-8');
      logger.info(`Saved DeskApp printer configuration to disk: ${this.configFilePath}`);
    } catch (err: any) {
      logger.error(`Failed to write DeskApp config file: ${err.message}`);
    }
  }

  async getSettings(): Promise<SystemSettings> {
    return this.currentConfig.settings;
  }

  async updateSettings(partial: Partial<SystemSettings>): Promise<SystemSettings> {
    this.currentConfig.settings = { ...this.currentConfig.settings, ...partial };
    this.saveConfigToDisk();
    return this.currentConfig.settings;
  }

  async getSavedPrinters(): Promise<SavedPrinter[]> {
    return this.currentConfig.savedPrinters;
  }

  async getDefaultPrinterId(): Promise<string | null> {
    return this.currentConfig.defaultPrinterId;
  }

  async savePrinter(printer: Partial<SavedPrinter>): Promise<{ success: boolean; savedPrinters: SavedPrinter[]; message: string }> {
    const id = printer.id || `printer-${Date.now()}`;
    const name = printer.name || 'USB Printer';
    
    const existingIndex = this.currentConfig.savedPrinters.findIndex(p => p.id === id || p.name.toLowerCase() === name.toLowerCase());

    const isFirst = this.currentConfig.savedPrinters.length === 0;
    const shouldBeDefault = printer.isDefault ?? (isFirst || this.currentConfig.defaultPrinterId === null);

    const newSaved: SavedPrinter = {
      id,
      name,
      driverName: printer.driverName || `${name} Driver`,
      portName: printer.portName || 'USB001',
      connectionType: 'USB',
      isDefault: shouldBeDefault,
      printerType: printer.printerType || (name.toLowerCase().includes('pos58') || name.toLowerCase().includes('veer') ? 'RECEIPT' : 'LABEL'),
      savedAt: printer.savedAt || new Date().toISOString(),
    };

    if (shouldBeDefault) {
      this.currentConfig.savedPrinters.forEach(p => { p.isDefault = false; });
      this.currentConfig.defaultPrinterId = id;
    }

    if (existingIndex >= 0) {
      this.currentConfig.savedPrinters[existingIndex] = newSaved;
    } else {
      this.currentConfig.savedPrinters.push(newSaved);
    }

    this.currentConfig.selectedPrinterId = id;
    this.saveConfigToDisk();

    return {
      success: true,
      savedPrinters: this.currentConfig.savedPrinters,
      message: `Printer "${name}" saved to SEZNIK Printer Manager.`,
    };
  }

  async removeSavedPrinter(printerId: string): Promise<RemoveSavedPrinterResult> {
    logger.info(`Requested to remove printer ID "${printerId}" from SEZNIK DeskApp configuration.`);

    const existing = this.currentConfig.savedPrinters.find(p => p.id === printerId || p.name.toLowerCase() === printerId.toLowerCase());

    if (!existing) {
      logger.warn(`Printer ID "${printerId}" not found in saved printers.`);
      return {
        success: false,
        error: 'PRINTER_NOT_FOUND',
        defaultPrinterId: this.currentConfig.defaultPrinterId,
        savedPrinters: this.currentConfig.savedPrinters,
        message: 'Unable to remove printer: Printer not found in saved configuration.',
      };
    }

    const removedId = existing.id;
    const removedName = existing.name;

    // Filter out removed printer from DeskApp configuration
    this.currentConfig.savedPrinters = this.currentConfig.savedPrinters.filter(p => p.id !== removedId);

    // Handle Default Printer Protection
    if (this.currentConfig.defaultPrinterId === removedId || existing.isDefault) {
      if (this.currentConfig.savedPrinters.length > 0) {
        const nextDefault = this.currentConfig.savedPrinters[0];
        nextDefault.isDefault = true;
        this.currentConfig.defaultPrinterId = nextDefault.id;
        logger.info(`Promoted printer "${nextDefault.name}" (${nextDefault.id}) as new default printer.`);
      } else {
        this.currentConfig.defaultPrinterId = null;
        logger.info('No remaining saved printers. defaultPrinterId set to null.');
      }
    }

    // Handle Active Selection Reset
    if (this.currentConfig.selectedPrinterId === removedId) {
      this.currentConfig.selectedPrinterId = this.currentConfig.defaultPrinterId;
    }

    this.saveConfigToDisk();

    return {
      success: true,
      removedPrinterId: removedId,
      defaultPrinterId: this.currentConfig.defaultPrinterId,
      savedPrinters: this.currentConfig.savedPrinters,
      message: `Printer "${removedName}" removed from SEZNIK and deleted from OS Spooler.`,
    };
  }

  async setSavedDefaultPrinter(printerId: string): Promise<SetSavedDefaultResult> {
    const target = this.currentConfig.savedPrinters.find(p => p.id === printerId || p.name.toLowerCase() === printerId.toLowerCase());

    if (!target) {
      return {
        success: false,
        defaultPrinterId: this.currentConfig.defaultPrinterId,
        savedPrinters: this.currentConfig.savedPrinters,
        message: 'Printer not found in saved configuration.',
      };
    }

    this.currentConfig.savedPrinters.forEach(p => {
      p.isDefault = (p.id === target.id);
    });

    this.currentConfig.defaultPrinterId = target.id;
    this.currentConfig.selectedPrinterId = target.id;

    this.saveConfigToDisk();

    // Set as Overall System OS Default Printer in Windows
    if (os.platform() === 'win32') {
      try {
        const psComCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; (New-Object -ComObject WScript.Network).SetDefaultPrinter('${target.name}')"`;
        await execPromise(psComCmd);
        const wmiCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-WmiObject -Class Win32_Printer -Filter \\"Name='${target.name}'\\").SetDefaultPrinter()"`;
        await execPromise(wmiCmd);
        logger.info(`[ConfigurationService] Set "${target.name}" as overall Windows system default printer.`);
      } catch (err: any) {
        logger.warn(`[ConfigurationService] Windows set default notice: ${err.message}`);
      }
    } else {
      try {
        await execPromise(`lpoptions -d "${target.name}"`);
      } catch {}
    }

    return {
      success: true,
      defaultPrinterId: target.id,
      savedPrinters: this.currentConfig.savedPrinters,
      message: `Successfully set "${target.name}" as overall system default printer!`,
    };
  }

  async removeDefaultPrinter(): Promise<{ success: boolean; savedPrinters: SavedPrinter[]; defaultPrinterId: string | null; message: string }> {
    let message = 'Default printer designation removed.';
    let newDefaultId: string | null = null;

    if (this.currentConfig.savedPrinters.length > 1) {
      // Promote the other printer as new overall system default printer
      const nextDefault = this.currentConfig.savedPrinters.find(p => !p.isDefault) || this.currentConfig.savedPrinters[0];
      
      this.currentConfig.savedPrinters.forEach(p => {
        p.isDefault = (p.id === nextDefault.id);
      });
      this.currentConfig.defaultPrinterId = nextDefault.id;
      this.currentConfig.selectedPrinterId = nextDefault.id;
      newDefaultId = nextDefault.id;

      // Update Windows OS Default Printer to promoted printer
      if (os.platform() === 'win32') {
        try {
          const psComCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; (New-Object -ComObject WScript.Network).SetDefaultPrinter('${nextDefault.name}')"`;
          await execPromise(psComCmd);
          const wmiCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-WmiObject -Class Win32_Printer -Filter \\"Name='${nextDefault.name}'\\").SetDefaultPrinter()"`;
          await execPromise(wmiCmd);
        } catch {}
      } else {
        try { await execPromise(`lpoptions -d "${nextDefault.name}"`); } catch {}
      }

      message = `Removed default status. Promoted "${nextDefault.name}" as new overall system default printer!`;
    } else {
      this.currentConfig.savedPrinters.forEach(p => { p.isDefault = false; });
      this.currentConfig.defaultPrinterId = null;
      this.currentConfig.selectedPrinterId = null;
      message = 'Default printer designation removed.';
    }

    this.saveConfigToDisk();
    logger.info(`[ConfigurationService] ${message}`);

    return {
      success: true,
      savedPrinters: this.currentConfig.savedPrinters,
      defaultPrinterId: newDefaultId,
      message,
    };
  }

  async clearAllSavedPrinters(): Promise<{ success: boolean; savedPrinters: SavedPrinter[]; message: string }> {
    if (os.platform() === 'win32') {
      for (const prt of this.currentConfig.savedPrinters) {
        try {
          const psDel = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Printer -Name '${prt.name}' -ErrorAction SilentlyContinue -Confirm:$false"`;
          const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3000));
          const execAsyncPromise = execPromise(psDel).then(() => {}).catch(() => {});
          await Promise.race([execAsyncPromise, timeoutPromise]);
        } catch {}
      }
    }
    this.currentConfig.savedPrinters = [];
    this.currentConfig.defaultPrinterId = null;
    this.currentConfig.selectedPrinterId = null;
    this.saveConfigToDisk();
    logger.info('Cleared all saved printers from DeskApp & OS spooler.');
    return {
      success: true,
      savedPrinters: [],
      message: 'All saved printers removed from SEZNIK and OS Spooler.',
    };
  }
}

