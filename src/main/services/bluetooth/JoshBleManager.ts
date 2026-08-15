import { JoshBleCandidate, JoshSetupState } from '../../../shared/types';
import { JoshBleScanner } from './bleScanner';
import { JoshBleConnection, BleConnectResult } from './bleConnection';
import { JoshPrinter } from '../printers/JoshPrinter';
import { PrinterPersistenceService } from '../PrinterPersistenceService';
import logger from '../../logger';

export class JoshBleManager {
  private scanner: JoshBleScanner;
  private connection: JoshBleConnection;
  private persistence: PrinterPersistenceService;

  constructor() {
    this.scanner = new JoshBleScanner();
    this.connection = new JoshBleConnection();
    this.persistence = new PrinterPersistenceService();
  }

  /**
   * Scans for real nearby JOSH BLE devices.
   */
  async scanJoshCandidates(): Promise<{ candidates: JoshBleCandidate[]; bluetoothEnabled: boolean; error?: string }> {
    logger.info('[JoshBleManager] Initiating scan for JOSH BLE candidates...');
    return this.scanner.scanForJoshBleDevices();
  }

  /**
   * Connects to a specific JOSH BLE candidate, verifies GATT services, and registers the Windows Spooler queue.
   */
  async connectAndConfigureJosh(candidate: JoshBleCandidate): Promise<{
    success: boolean;
    queueName: string;
    driverUsed: string;
    connectResult: BleConnectResult;
    message: string;
  }> {
    logger.info(`[JoshBleManager] Connecting and configuring JOSH candidate "${candidate.name}" (${candidate.address})...`);

    // 1. Establish real BLE GATT connection & discover services
    const connectResult = await this.connection.connectAndDiscoverGatt(candidate.address, candidate.name);
    if (!connectResult.connected) {
      return {
        success: false,
        queueName: '',
        driverUsed: '',
        connectResult,
        message: connectResult.message,
      };
    }

    // 2. Register Windows Printer Queue
    const queueName = `${candidate.name} (Bluetooth)`;
    const comPort = candidate.comPort || 'COM3'; // Fallback to serial port
    const queueResult = await this.connection.registerJoshBluetoothQueue(comPort, queueName);

    // 3. Persist to Saved Printers
    try {
      await this.persistence.saveOrUpdatePrinter({
        id: `josh-bt-${candidate.address.toLowerCase()}`,
        name: queueName,
        driverName: 'DP27 Label Printer',
        portName: comPort,
        connectionType: 'BLUETOOTH',
        isDefault: false,
        printerType: 'LABEL',
        macAddress: candidate.address,
      });
    } catch (persistErr: any) {
      logger.warn(`[JoshBleManager] Persistence notice: ${persistErr.message}`);
    }

    return {
      success: true,
      queueName,
      driverUsed: queueResult.driverUsed,
      connectResult,
      message: `JOSH BLE Connected & Configured on Windows Queue "${queueName}".`,
    };
  }

  /**
   * Performs the official JOSH BLE test print (TSPL 50x50mm barcode label).
   */
  async printBleTestLabel(queueName: string, macAddress?: string): Promise<{ success: boolean; message: string }> {
    logger.info(`[JoshBleManager] Printing JOSH BLE test label to "${queueName}"...`);
    return JoshPrinter.printTestLabel({ queueName, macAddress });
  }
}
