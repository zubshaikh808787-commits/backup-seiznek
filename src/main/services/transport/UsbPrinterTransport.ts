import { DetectedPrinter, PrintResult } from '../../../shared/types';
import { WindowsUsbTransport } from './WindowsUsbTransport';
import { MacUsbTransport } from './MacUsbTransport';

export interface UsbPrinterTransport {
  discover(): Promise<DetectedPrinter[]>;
  connect(printerId: string): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  isReady(printerId: string): Promise<boolean>;
  write(printerId: string, data: Buffer): Promise<PrintResult>;
  testPrint(printerId: string): Promise<PrintResult>;
}

export class UsbTransportFactory {
  private static winTransport: WindowsUsbTransport | null = null;
  private static macTransport: MacUsbTransport | null = null;

  static getTransport(): UsbPrinterTransport {
    if (process.platform === 'win32') {
      if (!this.winTransport) {
        this.winTransport = new WindowsUsbTransport();
      }
      return this.winTransport;
    } else {
      if (!this.macTransport) {
        this.macTransport = new MacUsbTransport();
      }
      return this.macTransport;
    }
  }
}
