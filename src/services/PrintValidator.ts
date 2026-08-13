import logger from '../main/logger';
import { ConnectionType, V1PrinterProfileBrand } from '../shared/types';

export type PrinterRoleType = 'LABEL' | 'RECEIPT' | 'RECEIPT_AND_LABEL' | 'UNSUPPORTED';
export type PrintJobType = 'LABEL' | 'RECEIPT' | 'BOTH' | 'NONE';

export interface PrintJobValidationRequest {
  jobId: string;
  brand: V1PrinterProfileBrand;
  printerType: PrinterRoleType;
  jobType: PrintJobType;
  transport: ConnectionType;
  protocol: string;
  payloadLength: number;
}

export interface PrintValidationResult {
  valid: boolean;
  jobId: string;
  error?: string;
}

export class PrintValidator {
  static validateJob(req: PrintJobValidationRequest): PrintValidationResult {
    logger.info(`========================================================`);
    logger.info(`[USB_PRINT JOB INITIATED]`);
    logger.info(`Job ID:       ${req.jobId}`);
    logger.info(`Brand:        ${req.brand}`);
    logger.info(`Printer Type: ${req.printerType}`);
    logger.info(`Job Type:     ${req.jobType}`);
    logger.info(`Transport:    ${req.transport}`);
    logger.info(`Protocol:     ${req.protocol}`);
    logger.info(`Payload Size: ${req.payloadLength} bytes`);
    logger.info(`========================================================`);

    if (req.brand === 'JOSH' && req.jobType !== 'LABEL') {
      const errorMsg = 'JOSH_REQUIRES_LABEL_DOCUMENT: JOSH is configured as a Label Printer.';
      logger.error(`[PRINT VALIDATION REJECTED ❌] Job ID: ${req.jobId} | Reason: ${errorMsg}`);
      return { valid: false, jobId: req.jobId, error: errorMsg };
    }

    if (req.brand === 'VEER' && req.jobType !== 'RECEIPT') {
      logger.info(`[PRINT VALIDATION ADAPTOR] VEER printer requested with jobType '${req.jobType}'. Auto-adapting payload to VEER 58mm ESC/POS format.`);
    }

    logger.info(`[PRINT VALIDATION PASS ✓] Job ID: ${req.jobId} approved for transmission.`);
    return { valid: true, jobId: req.jobId };
  }

  static createJobId(brand: V1PrinterProfileBrand, jobType: string): string {
    return `${brand}-${jobType}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}
