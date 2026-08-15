import { PrinterIdentity } from '../../../shared/types';
import { JOSH_BLE_CONSTANTS } from '../bluetooth/bleConstants';
import logger from '../../logger';

export interface DeviceMatchCandidate {
  name?: string;
  pnpDeviceId?: string;
  vendorId?: string;
  productId?: string;
  bluetoothAddress?: string;
  serviceUuids?: string[];
  characteristicUuids?: string[];
  driverName?: string;
  service?: string;
}

export class PrinterIdentityService {
  /**
   * Evaluates any hardware candidate against strict JOSH, VEER, and DEV profiles.
   * Returns a complete PrinterIdentity with confidence scoring and reasons.
   */
  static identify(candidate: DeviceMatchCandidate, connectionType: 'USB' | 'BLE' | 'SPP' = 'USB'): PrinterIdentity {
    const name = (candidate.name || '').trim();
    const nameLower = name.toLowerCase();
    const pnpLower = (candidate.pnpDeviceId || '').toLowerCase();
    const driverLower = (candidate.driverName || '').toLowerCase();
    const svcLower = (candidate.service || '').toLowerCase();
    const fullText = `${nameLower} ${pnpLower} ${driverLower} ${svcLower}`;
    
    const detectionDetails: string[] = [];
    let joshScore = 0;
    let veerScore = 0;
    let devScore = 0;

    // --- 1. JOSH IDENTIFIERS ---
    // Check USB VID / PID
    const vid = (candidate.vendorId || '').replace(/^0x/i, '').toUpperCase();
    const pid = (candidate.productId || '').replace(/^0x/i, '').toUpperCase();
    const vidPid = vid && pid ? `${vid}:${pid}` : vid;

    if (vidPid && JOSH_BLE_CONSTANTS.USB_VID_PIDS.some(id => vidPid.includes(id))) {
      joshScore += 45;
      detectionDetails.push(`Matched known JOSH USB Silicon VID:PID (${vidPid})`);
    }

    // Check BLE Device Name prefixes
    if (JOSH_BLE_CONSTANTS.NAME_PREFIXES.some(p => nameLower.includes(p))) {
      joshScore += 50;
      detectionDetails.push(`Matched known JOSH Device Name pattern ("${name}")`);
    }

    // Check BLE GATT Service UUIDs
    const services = candidate.serviceUuids || [];
    for (const s of services) {
      const sLower = s.toLowerCase();
      if (sLower.includes('ff00') || sLower.includes('ff10')) {
        joshScore += 40;
        detectionDetails.push(`Matched DeTong Label GATT Service UUID (${s})`);
      }
      if (sLower.includes('49535343')) {
        joshScore += 40;
        detectionDetails.push(`Matched LD0801 ISSC Transparent Serial GATT Service UUID (${s})`);
      }
    }

    // Check Windows Driver Names
    if (driverLower.includes('dp27') || driverLower.includes('ld0801') || driverLower.includes('detong')) {
      joshScore += 30;
      detectionDetails.push(`Bound to Windows JOSH Label Driver ("${candidate.driverName}")`);
    }

    // --- 2. VEER IDENTIFIERS (Cross-Detection Protection) ---
    if (
      nameLower.includes('pos58') ||
      nameLower.includes('pos-58') ||
      nameLower.includes('veer') ||
      nameLower.includes('mpt-ii') ||
      nameLower.includes('mpt') ||
      nameLower.includes('prt80') ||
      nameLower.includes('olivetti') ||
      nameLower.includes('58mm') ||
      nameLower.includes('receipt')
    ) {
      veerScore += 60;
      detectionDetails.push(`Matched VEER Receipt Printer keyword ("${name}")`);
    }
    if (driverLower.includes('pos58') || driverLower.includes('pos-58')) {
      veerScore += 40;
      detectionDetails.push(`Bound to POS58 Receipt Driver ("${candidate.driverName}")`);
    }

    // --- 3. DEV IDENTIFIERS (Cross-Detection Protection) ---
    if (
      nameLower.includes('sz-80d') ||
      nameLower.includes('dev-58') ||
      nameLower.includes('dev-80') ||
      nameLower.includes('pos80') ||
      nameLower.includes('pos-80') ||
      (nameLower.includes('dev') && !nameLower.includes('device') && !nameLower.includes('developer'))
    ) {
      devScore += 60;
      detectionDetails.push(`Matched DEV Dual-Mode 80mm keyword ("${name}")`);
    }

    // --- RESOLUTION & ARBITRATION ---
    // If candidate strongly matches VEER or DEV, reject JOSH
    if (veerScore > joshScore && veerScore >= 50) {
      logger.info(`[PrinterIdentity] Cross-detection: Candidate "${name}" identified as [VEER] (Score: ${veerScore}). Rejected as JOSH.`);
      return {
        printerModel: 'VEER',
        connectionType,
        deviceId: candidate.pnpDeviceId || candidate.bluetoothAddress || name,
        vendorId: candidate.vendorId,
        productId: candidate.productId,
        pnpDeviceId: candidate.pnpDeviceId,
        bluetoothName: candidate.name,
        bluetoothAddress: candidate.bluetoothAddress,
        windowsPrinterName: candidate.name,
        driverName: candidate.driverName || 'POS58',
        isConfirmedJosh: false,
        confidenceScore: veerScore,
        detectionDetails,
      };
    }

    if (devScore > joshScore && devScore >= 50) {
      logger.info(`[PrinterIdentity] Cross-detection: Candidate "${name}" identified as [DEV] (Score: ${devScore}). Rejected as JOSH.`);
      return {
        printerModel: 'DEV',
        connectionType,
        deviceId: candidate.pnpDeviceId || candidate.bluetoothAddress || name,
        vendorId: candidate.vendorId,
        productId: candidate.productId,
        pnpDeviceId: candidate.pnpDeviceId,
        bluetoothName: candidate.name,
        bluetoothAddress: candidate.bluetoothAddress,
        windowsPrinterName: candidate.name,
        driverName: candidate.driverName,
        isConfirmedJosh: false,
        confidenceScore: devScore,
        detectionDetails,
      };
    }

    // Check if confident JOSH
    if (joshScore >= 35) {
      logger.info(`[PrinterIdentity] Confirmed JOSH printer: "${name}" (Confidence: ${joshScore}%). Details: ${detectionDetails.join('; ')}`);
      return {
        printerModel: 'JOSH',
        connectionType,
        deviceId: candidate.pnpDeviceId || candidate.bluetoothAddress || name,
        vendorId: candidate.vendorId,
        productId: candidate.productId,
        pnpDeviceId: candidate.pnpDeviceId,
        bluetoothName: candidate.name,
        bluetoothAddress: candidate.bluetoothAddress,
        serviceUuid: services.find(s => s.toLowerCase().includes('ff00') || s.toLowerCase().includes('49535343')),
        windowsPrinterName: candidate.name,
        driverName: candidate.driverName || 'DP27 Label Printer',
        isConfirmedJosh: true,
        confidenceScore: Math.min(joshScore, 100),
        detectionDetails,
      };
    }

    // Ambiguous / Unknown
    logger.warn(`[PrinterIdentity] Ambiguous printer candidate: "${name}" (JOSH score: ${joshScore}, VEER: ${veerScore}, DEV: ${devScore}).`);
    return {
      printerModel: joshScore > 0 ? 'AMBIGUOUS' : 'UNKNOWN',
      connectionType,
      deviceId: candidate.pnpDeviceId || candidate.bluetoothAddress || name,
      vendorId: candidate.vendorId,
      productId: candidate.productId,
      pnpDeviceId: candidate.pnpDeviceId,
      bluetoothName: candidate.name,
      bluetoothAddress: candidate.bluetoothAddress,
      windowsPrinterName: candidate.name,
      driverName: candidate.driverName,
      isConfirmedJosh: false,
      confidenceScore: joshScore,
      detectionDetails,
    };
  }

  static isJoshPrinter(candidate: DeviceMatchCandidate): boolean {
    const identity = this.identify(candidate);
    return identity.isConfirmedJosh && identity.printerModel === 'JOSH';
  }
}
