import { SavedPrinter } from '../../shared/types';
import logger from '../logger';
import path from 'path';
import os from 'os';
import fs from 'fs';

export class PrinterPersistenceService {
  private configFilePath: string;

  constructor() {
    this.configFilePath = path.join(os.homedir(), '.seznik-printers.json');
  }

  private loadConfig(): { savedPrinters: SavedPrinter[]; defaultPrinterId: string | null } {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          savedPrinters: parsed.savedPrinters || [],
          defaultPrinterId: parsed.defaultPrinterId || null,
        };
      }
    } catch (err: any) {
      logger.warn(`[PrinterPersistenceService] Failed to load config: ${err.message}`);
    }
    return { savedPrinters: [], defaultPrinterId: null };
  }

  private saveConfig(data: { savedPrinters: SavedPrinter[]; defaultPrinterId: string | null }): void {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`[PrinterPersistenceService] Saved configuration to disk: ${this.configFilePath}`);
    } catch (err: any) {
      logger.error(`[PrinterPersistenceService] Error writing config: ${err.message}`);
    }
  }

  async getSavedPrinters(): Promise<SavedPrinter[]> {
    return this.loadConfig().savedPrinters;
  }

  /**
   * Persists printer. Handles deduplication so reconnecting the same printer does not create duplicate entries!
   */
  async saveOrUpdatePrinter(printer: Partial<SavedPrinter>): Promise<{ printerId: string; savedPrinters: SavedPrinter[] }> {
    const data = this.loadConfig();
    const name = printer.name || 'USB Printer';
    const targetId = printer.id || `seznik-${name.replace(/\s+/g, '-').toLowerCase()}`;

    // Deduplication check: Match by ID or Name
    const existingIndex = data.savedPrinters.findIndex(p => p.id === targetId || p.name.toLowerCase() === name.toLowerCase());

    const savedRecord: SavedPrinter = {
      id: targetId,
      name,
      driverName: printer.driverName || `${name} Driver`,
      portName: printer.portName || 'USB001',
      connectionType: 'USB',
      isDefault: printer.isDefault ?? true,
      printerType: printer.printerType || 'RECEIPT',
      savedAt: new Date().toISOString(),
    };

    if (savedRecord.isDefault) {
      data.savedPrinters.forEach(p => { p.isDefault = false; });
      data.defaultPrinterId = targetId;
    }

    if (existingIndex >= 0) {
      data.savedPrinters[existingIndex] = savedRecord;
      logger.info(`[PrinterPersistenceService] Updated existing printer record: "${name}" [ID: ${targetId}]`);
    } else {
      data.savedPrinters.push(savedRecord);
      logger.info(`[PrinterPersistenceService] Saved new printer record: "${name}" [ID: ${targetId}]`);
    }

    this.saveConfig(data);

    return { printerId: targetId, savedPrinters: data.savedPrinters };
  }

  async removeSavedPrinter(printerId: string): Promise<{ success: boolean; removedPrinterId: string; defaultPrinterId: string | null; savedPrinters: SavedPrinter[]; message: string }> {
    logger.info(`[PrinterPersistenceService] Requested to remove printer ID "${printerId}" from configuration.`);
    const data = this.loadConfig();
    const existing = data.savedPrinters.find(p => p.id === printerId || p.name.toLowerCase() === printerId.toLowerCase());

    if (!existing) {
      logger.warn(`[PrinterPersistenceService] Printer ID "${printerId}" not found in saved printers.`);
      return {
        success: true,
        removedPrinterId: printerId,
        defaultPrinterId: data.defaultPrinterId,
        savedPrinters: data.savedPrinters,
        message: 'Printer is already removed from saved configuration.',
      };
    }

    const removedId = existing.id;
    const removedName = existing.name;

    data.savedPrinters = data.savedPrinters.filter(p => p.id !== removedId);

    if (data.defaultPrinterId === removedId || existing.isDefault) {
      if (data.savedPrinters.length > 0) {
        data.savedPrinters[0].isDefault = true;
        data.defaultPrinterId = data.savedPrinters[0].id;
      } else {
        data.defaultPrinterId = null;
      }
    }

    this.saveConfig(data);

    return {
      success: true,
      removedPrinterId: removedId,
      defaultPrinterId: data.defaultPrinterId,
      savedPrinters: data.savedPrinters,
      message: `Printer "${removedName}" removed successfully.`,
    };
  }

  async clearAllSavedPrinters(): Promise<{ success: boolean; savedPrinters: SavedPrinter[]; message: string }> {
    const data = { savedPrinters: [], defaultPrinterId: null };
    this.saveConfig(data);
    logger.info(`[PrinterPersistenceService] Cleared all saved printers from disk.`);
    return { success: true, savedPrinters: [], message: 'All saved printers removed successfully.' };
  }
}
