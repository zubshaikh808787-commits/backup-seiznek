import fs from 'fs';
import path from 'path';
import { V1PrinterProfileBrand } from '../../shared/types';
import { DetectedUsbHardware } from './UsbDiscoveryService';
import logger from '../logger';

/**
 * Known VID:PID → Brand mapping table for thermal printers.
 * 
 * JOSH = 50x50mm Thermal Label Printer (DP27 / DeTong / DTPWeb / LD0801)
 * VEER = 58mm Thermal Receipt Printer (POS58 / XP-58 / ZJ-58 / Olivetti PRT80)
 * DEV  = Dual mode 80mm Printer (SZ-80D)
 */
const VID_PID_BRAND_MAP: Record<string, V1PrinterProfileBrand> = {
  // JOSH (DP27 / 50x50mm Thermal Label Printer)
  '4B43:2D37': 'JOSH',  // DeTong DP27 / LD0801 label printer
  '4B43': 'JOSH',       // DeTong / DTPWeb label printer family
  '2D37': 'JOSH',       // DeTong label printer controller
  '3533:5A11': 'JOSH',  // DeTong / JOSH USB Printing Support
  '3533': 'JOSH',

  // DEV (Dual mode 80mm)
  '0FE6': 'DEV',        // ITE Tech dual mode 80mm
  '0FE6:811E': 'DEV',
};

export class PrinterIdentificationService {
  /**
   * Automatically identifies the connected USB printer hardware brand.
   * JOSH -> JOSH (Label Printer -> Win Driver Driver JOSH Label Printer.exe)
   * VEER -> VEER (Receipt Printer -> POS58Setup driver)
   * DEV  -> DEV  (Dual mode -> DEV driver)
   */
  identifyHardware(device: DetectedUsbHardware): V1PrinterProfileBrand {
    const name = device.name.toLowerCase();
    const pnp = device.pnpDeviceId.toLowerCase();
    const svc = (device.service || '').toLowerCase();
    const combined = `${name} ${pnp} ${svc}`;

    logger.info(`[PrinterIdentificationService] Analyzing USB hardware: "${device.name}" [PnP: ${device.pnpDeviceId}] [Service/Driver: ${device.service}]`);

    // =============================================
    // STRATEGY 1: Explicit Keyword Matching
    // =============================================

    // Check JOSH (50x50mm Thermal Label Printer)
    const isJosh = 
      combined.includes('dp27') ||
      combined.includes('josh') ||
      combined.includes('ld0801') ||
      combined.includes('detong') ||
      combined.includes('dtpweb') ||
      combined.includes('tspl') ||
      combined.includes('sticker') ||
      combined.includes('label') ||
      combined.includes('dothantech') ||
      combined.includes('4b43') ||
      combined.includes('2d37') ||
      combined.includes('3533');

    if (isJosh) {
      logger.info(`[PrinterIdentificationService] Keyword match → [JOSH] (50x50mm Label Printer)`);
      return 'JOSH';
    }

    // Check DEV (Combo / Dual mode 80mm Printer)
    const isDev = 
      combined.includes('sz-80d') ||
      combined.includes('dev-58') ||
      combined.includes('dev-80') ||
      combined.includes('pos80') ||
      combined.includes('pos-80') ||
      (combined.includes('dev') && !combined.includes('device') && !combined.includes('developer'));

    if (isDev) {
      logger.info(`[PrinterIdentificationService] Keyword match → [DEV] (80mm Dual Mode)`);
      return 'DEV';
    }

    // Check VEER (58mm Thermal Receipt Printer)
    const isVeer = 
      combined.includes('pos58') ||
      combined.includes('pos-58') ||
      combined.includes('pos 58') ||
      combined.includes('veer') ||
      combined.includes('58mm') ||
      combined.includes('receipt') ||
      combined.includes('olivetti') ||
      combined.includes('prt80') ||
      combined.includes('xprinter') ||
      combined.includes('zjiang') ||
      combined.includes('gprinter');

    if (isVeer) {
      logger.info(`[PrinterIdentificationService] Keyword match → [VEER] (58mm Receipt Printer)`);
      return 'VEER';
    }

    // =============================================
    // STRATEGY 2: Physical Silicon VID / PID Hardware Lookup
    // =============================================
    const vidMatch = pnp.match(/vid_([0-9a-f]{4})/i);
    const pidMatch = pnp.match(/pid_([0-9a-f]{4})/i);

    const vid = (device.vendorId || (vidMatch ? `0x${vidMatch[1]}` : '')).replace('0x', '').toUpperCase();
    const pid = (device.productId || (pidMatch ? `0x${pidMatch[1]}` : '')).replace('0x', '').toUpperCase();

    if (vid) {
      const exactKey = pid ? `${vid}:${pid}` : vid;
      if (VID_PID_BRAND_MAP[exactKey]) {
        const brand = VID_PID_BRAND_MAP[exactKey];
        logger.info(`[PrinterIdentificationService] Silicon VID:PID exact match (${exactKey}) → [${brand}]`);
        return brand;
      }

      if (VID_PID_BRAND_MAP[vid]) {
        const brand = VID_PID_BRAND_MAP[vid];
        logger.info(`[PrinterIdentificationService] Silicon VID match (${vid}) → [${brand}]`);
        return brand;
      }
    }

    // =============================================
    // STRATEGY 3: Local Driver Folder Presence Priority
    // Check local driver presence for VEER and JOSH
    // =============================================
    const veerExePaths = [
      'C:\\Users\\omen\\OneDrive\\Desktop\\VEER Thermal printer files\\POS58Setup_20210916.exe',
      'C:\\Users\\omen\\Downloads\\VEER Thermal printer files\\POS58Setup_20210916.exe',
      path.resolve(process.cwd(), 'backend/src/config/veer-files/POS58Setup_20210916.exe'),
    ];

    const joshExePaths = [
      'C:\\Users\\omen\\OneDrive\\Desktop\\josh-files\\Win Driver Driver JOSH Label Printer.exe',
      'C:\\Users\\omen\\OneDrive\\Desktop\\josh-files\\DTPWeb-Inst-2.1.2022.1230.exe',
      path.resolve(process.cwd(), 'backend/src/config/josh-files/Win Driver Driver JOSH Label Printer.exe'),
    ];

    if (combined.includes('pos') || combined.includes('receipt') || combined.includes('58')) {
      for (const vPath of veerExePaths) {
        if (fs.existsSync(vPath)) {
          logger.info(`[PrinterIdentificationService] Found VEER Driver package at "${vPath}". Assigning hardware to [VEER].`);
          return 'VEER';
        }
      }
    }

    for (const jPath of joshExePaths) {
      if (fs.existsSync(jPath)) {
        logger.info(`[PrinterIdentificationService] Found JOSH Driver package at "${jPath}". Assigning connected USB hardware to [JOSH] (Label Printer).`);
        return 'JOSH';
      }
    }

    logger.info(`[PrinterIdentificationService] Defaulting connected USB device "${device.name}" to [JOSH] (Label Printer).`);
    return 'JOSH';
  }
}

