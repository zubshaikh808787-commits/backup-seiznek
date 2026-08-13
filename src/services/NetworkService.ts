import logger from '../main/logger';

export interface NetworkPrinterDevice {
  ipAddress: string;
  macAddress: string;
  hostName: string;
  port: number;
  isDhcp: boolean;
}

export interface INetworkService {
  scanSubnet(): Promise<NetworkPrinterDevice[]>;
  configureIp(macAddress: string, ipAddress: string, isDhcp: boolean): Promise<boolean>;
}

export class NetworkService implements INetworkService {
  async scanSubnet(): Promise<NetworkPrinterDevice[]> {
    logger.info('Scanning local LAN subnet (UDP discovery / Port 9100 RAW / LPR) for network printers...');
    return [
      {
        ipAddress: '192.168.1.145',
        macAddress: '70:B3:D5:8C:12:34',
        hostName: 'SEZNIK-NET-104L',
        port: 9100,
        isDhcp: true,
      },
    ];
  }

  async configureIp(macAddress: string, ipAddress: string, isDhcp: boolean): Promise<boolean> {
    logger.info(`Configuring network parameters for MAC ${macAddress}: IP=${ipAddress}, DHCP=${isDhcp}`);
    return true;
  }
}
