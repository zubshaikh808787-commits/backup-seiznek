import { DeviceIdentification } from '../shared/types';
import { UsbDiscoveryService } from '../main/services/UsbDiscoveryService';
import logger from '../main/logger';

export class USBService {
  private discovery = new UsbDiscoveryService();

  async scanUsbDevices(): Promise<DeviceIdentification[]> {
    logger.info('[USBService] Scanning physical USB bus for attached hardware...');
    const detected = await this.discovery.scanPhysicalUsbDevices();

    return detected.map(d => ({
      vendorId: d.vendorId || '0x0000',
      productId: d.productId || '0x0000',
      modelNumber: d.name,
      manufacturer: 'USB Printer',
      paperWidthMm: 58,
      printerLanguage: 'ESC/POS / TSPL',
      supportsDualMode: true,
    }));
  }

  startHotplugMonitoring(
    onDeviceDetected: (device: DeviceIdentification) => void,
    onUnplugged?: (vid: string, pid: string) => void
  ): void {
    let lastDevices: DeviceIdentification[] = [];

    this.discovery.startHotplugMonitoring((detectedList) => {
      const currentDevices: DeviceIdentification[] = detectedList.map(d => ({
        vendorId: d.vendorId || '0x0000',
        productId: d.productId || '0x0000',
        modelNumber: d.name,
        manufacturer: 'USB Printer',
        paperWidthMm: 58,
        printerLanguage: 'ESC/POS / TSPL',
        supportsDualMode: true,
      }));

      for (const dev of currentDevices) {
        if (!lastDevices.some(ld => ld.vendorId === dev.vendorId && ld.productId === dev.productId)) {
          onDeviceDetected(dev);
        }
      }

      if (onUnplugged) {
        for (const ld of lastDevices) {
          if (!currentDevices.some(cd => cd.vendorId === ld.vendorId && cd.productId === ld.productId)) {
            onUnplugged(ld.vendorId, ld.productId);
          }
        }
      }

      lastDevices = currentDevices;
    });
  }

  stopHotplugMonitoring(): void {
    this.discovery.stopHotplugMonitoring();
  }
}
