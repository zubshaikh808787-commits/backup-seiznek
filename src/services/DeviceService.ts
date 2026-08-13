import { DeviceIdentification } from '../shared/types';
import logger from '../main/logger';

export class DeviceService {
  async identifyDevice(vendorId: string, productId: string): Promise<DeviceIdentification | null> {
    logger.info(`[DeviceService] Querying hardware VID: ${vendorId}, PID: ${productId}`);
    return null;
  }
}
