import os from 'os';
import { WindowsBleTransport } from './WindowsBleTransport';
import { MacBleTransport } from './MacBleTransport';

export class BleTransportFactory {
  private static instance: WindowsBleTransport | MacBleTransport | null = null;

  static getTransport(): WindowsBleTransport | MacBleTransport {
    if (!BleTransportFactory.instance) {
      if (os.platform() === 'darwin') {
        BleTransportFactory.instance = new MacBleTransport();
      } else {
        BleTransportFactory.instance = new WindowsBleTransport();
      }
    }
    return BleTransportFactory.instance;
  }
}
