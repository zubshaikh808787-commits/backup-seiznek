import { PrinterProfile, JOSH_PROFILE, VEER_PROFILE, DEV_PROFILE, V1PrinterProfileBrand } from '../../shared/types';
import logger from '../logger';

export class PrinterProfileService {
  getProfile(brand: V1PrinterProfileBrand): PrinterProfile {
    switch (brand) {
      case 'JOSH':
        logger.info('[PrinterProfileService] Loaded JOSH Profile (50x50mm TSPL Label)');
        return JOSH_PROFILE;
      case 'VEER':
        logger.info('[PrinterProfileService] Loaded VEER Profile (58mm ESC/POS Receipt)');
        return VEER_PROFILE;
      case 'DEV':
        logger.info('[PrinterProfileService] Loaded DEV Profile (Dual Label + Receipt)');
        return DEV_PROFILE;
      default:
        logger.warn('[PrinterProfileService] Unsupported hardware profile requested.');
        return {
          brand: 'UNSUPPORTED',
          type: 'UNSUPPORTED',
          documentType: 'NONE',
          paperWidthMm: 0,
          paperHeightMm: null,
          pipeline: 'UNSUPPORTED',
        };
    }
  }
}
