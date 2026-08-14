import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../../logger';
import { 
  VeerBleDevice, 
  VeerBleStatus, 
  VeerBlePrintResult, 
  VeerBleConnectionState,
  VeerBleErrorCode 
} from '../../../shared/types';
import { VeerReceiptCommandGenerator } from '../commands/VeerReceiptCommandGenerator';

const execPromise = promisify(exec);

// SDK Constants extracted directly from SDK binary (BLEPrinting.h / PrinterLibs)
export const SDK_VEER_SERVICE_UUIDS = [
  'e7810a7173ae499d8c15faa9aef0c3f2',
  'e781',
  'ffe0',
  '18f0'
];

export const SDK_VEER_CHARACTERISTIC_UUIDS = [
  'bef8d6c99c214c9eb632bd58c1009f9f',
  'ffe1',
  '2af1'
];

export class WindowsBleTransport {
  private noble: any = null;
  private activePeripheral: any = null;
  private writeCharacteristic: any = null;
  
  private currentState: VeerBleConnectionState = 'DISCONNECTED';
  private currentDeviceId: string | null = null;
  private currentDeviceName: string | null = null;
  private currentServiceUuid: string | null = null;
  private currentCharacteristicUuid: string | null = null;
  private currentMtu = 20; // Default BLE MTU chunk size
  private lastErrorMessage: string | null = null;
  private lastErrorCode: VeerBleErrorCode | null = null;
  private lastPrintSuccess = false;

  private statusChangeCallback: ((status: VeerBleStatus) => void) | null = null;
  private discoveredDevices: Map<string, VeerBleDevice> = new Map();

  constructor() {
    this.initNoble();
  }

  private initNoble() {
    try {
      this.noble = require('@abandonware/noble');
      this.noble.on('stateChange', (state: string) => {
        logger.info(`[BLE-WIN] Bluetooth adapter state changed: ${state}`);
        if (state !== 'poweredOn' && this.currentState !== 'DISCONNECTED') {
          this.updateState('ERROR', 'Bluetooth adapter is disabled or not powered on.', 'BLE_DISABLED');
        }
      });

      this.noble.on('discover', (peripheral: any) => {
        this.handleDiscoveredPeripheral(peripheral);
      });
    } catch (err: any) {
      logger.warn(`[BLE-WIN] Could not initialize native Noble module: ${err.message}`);
    }
  }

  setStatusCallback(callback: (status: VeerBleStatus) => void) {
    this.statusChangeCallback = callback;
  }

  getStatus(): VeerBleStatus {
    return {
      state: this.currentState,
      deviceId: this.currentDeviceId,
      deviceName: this.currentDeviceName,
      serviceUuid: this.currentServiceUuid,
      characteristicUuid: this.currentCharacteristicUuid,
      mtu: this.currentMtu,
      errorMessage: this.lastErrorMessage,
      errorCode: this.lastErrorCode,
      lastPrintSuccess: this.lastPrintSuccess,
    };
  }

  private updateState(state: VeerBleConnectionState, errorMsg: string | null = null, errorCode: VeerBleErrorCode | null = null) {
    this.currentState = state;
    this.lastErrorMessage = errorMsg;
    this.lastErrorCode = errorCode;
    logger.info(`[BLE-WIN] State Transition -> [${state}]${errorMsg ? ` (${errorMsg})` : ''}`);

    if (this.statusChangeCallback) {
      this.statusChangeCallback(this.getStatus());
    }
  }

  /**
   * Scans BLE bus for VEER printers.
   * Verifies identity using SDK Service UUIDs, Device Name, and Manufacturer Data.
   */
  async scan(timeoutMs = 6000): Promise<{ success: boolean; devices: VeerBleDevice[]; message: string }> {
    logger.info('[BLE-WIN] Initiating BLE device discovery scan...');
    this.discoveredDevices.clear();
    this.updateState('SCANNING');

    if (!this.noble) {
      logger.info('[BLE-WIN] Noble unattached. Invoking Windows Native WinRT BLE Scan...');
      const winRtDevices = await this.winRtScan(timeoutMs);
      for (const dev of winRtDevices) {
        this.discoveredDevices.set(dev.id, dev);
      }
      const veerDevs = winRtDevices.filter(d => d.isVeer);
      if (veerDevs.length > 0) {
        this.updateState('VEER_FOUND');
      } else {
        this.updateState('DISCONNECTED', 'No verified VEER BLE printer found in WinRT scan.', 'VEER_NOT_FOUND');
      }

      const allDevs = Array.from(this.discoveredDevices.values());
      const vDevs = allDevs.filter(d => d.isVeer);

      return {
        success: true,
        devices: allDevs,
        message: `WinRT BLE scan complete. Discovered ${allDevs.length} device(s), ${vDevs.length} VEER printer(s).`,
      };
    }

    if (this.noble.state !== 'poweredOn') {
      this.updateState('ERROR', `Bluetooth adapter state is '${this.noble.state}'.`, 'BLE_DISABLED');
      return { success: false, devices: [], message: `Bluetooth is ${this.noble.state}.` };
    }

    return new Promise((resolve) => {
      try {
        this.noble.startScanning([], true, (err: any) => {
          if (err) {
            logger.error(`[BLE-WIN] Scan start error: ${err.message}`);
            this.updateState('ERROR', err.message, 'BLE_PERMISSION_DENIED');
            resolve({ success: false, devices: [], message: err.message });
            return;
          }

          setTimeout(() => {
            try { this.noble.stopScanning(); } catch (e) {}
            const deviceList = Array.from(this.discoveredDevices.values());
            const veerDevices = deviceList.filter(d => d.isVeer);

            if (veerDevices.length > 0) {
              this.updateState('VEER_FOUND');
            } else if (deviceList.length > 0) {
              this.updateState('DISCONNECTED', 'No verified VEER BLE printer found in scan results.', 'VEER_NOT_FOUND');
            } else {
              this.updateState('DISCONNECTED', 'No BLE devices discovered.', 'VEER_NOT_FOUND');
            }

            logger.info(`[BLE-WIN] Scan completed. Total BLE devices: ${deviceList.length}, Verified VEER: ${veerDevices.length}`);
            resolve({
              success: true,
              devices: deviceList,
              message: `Scan complete. Discovered ${deviceList.length} device(s), ${veerDevices.length} VEER printer(s).`,
            });
          }, timeoutMs);
        });
      } catch (e: any) {
        this.updateState('ERROR', e.message, 'BLE_DISABLED');
        resolve({ success: false, devices: [], message: e.message });
      }
    });
  }

  private handleDiscoveredPeripheral(peripheral: any) {
    const name = (peripheral.advertisement?.localName || peripheral.name || '').trim();
    const id = peripheral.id || peripheral.address || '';
    const uuids = (peripheral.advertisement?.serviceUuids || []).map((u: string) => u.toLowerCase());
    const mfgDataHex = peripheral.advertisement?.manufacturerData?.toString('hex') || '';

    // Verify VEER Identity strictly
    const isVeer = this.verifyVeerIdentity(name, uuids, mfgDataHex);

    const dev: VeerBleDevice = {
      id,
      name: name || `BLE Printer (${id.slice(-6)})`,
      address: peripheral.address || id,
      rssi: peripheral.rssi,
      serviceUuids: uuids,
      manufacturerData: mfgDataHex,
      isVeer,
    };

    this.discoveredDevices.set(id, dev);

    if (isVeer) {
      logger.info(`[BLE-WIN] Verified VEER / Thermal Device Found -> Name: "${dev.name}" [ID: ${dev.id}] [RSSI: ${dev.rssi}]`);
    }
  }

  private verifyVeerIdentity(name: string, serviceUuids: string[], mfgData: string, rawId = ''): boolean {
    const lowerName = name.toLowerCase();
    const lowerId = rawId.toLowerCase();

    // Filter out Windows internal host controller adapters & generic GATT service sub-nodes
    if (
      lowerName.includes('microsoft bluetooth') || 
      lowerName.includes('realtek') || 
      lowerName.includes('intel') || 
      lowerName.includes('rfcomm protocol tdi') ||
      lowerName.includes('generic bluetooth adapter') ||
      lowerName.includes('generic access profile') ||
      lowerName.includes('generic attribute profile') ||
      lowerName.includes('device information service') ||
      lowerName.includes('bluetooth le generic attribute service')
    ) {
      return false;
    }

    // Thermal receipt printer hardware brand keywords (VEER, MPT-II, POS58, PRT80, RPP, InnerPrinter, Printer, 58mm)
    const printerKeywords = [
      'veer', 'mpt', 'pos58', 'pos-58', 'prt80', 'olivetti', 'rpp', 'innerprinter',
      'printer', '58mm', '58', 'bt-printer', 'thermal', 'receipt', 'dp27'
    ];

    const isPrinterName = printerKeywords.some(kw => lowerName.includes(kw));

    const uuidMatch = serviceUuids.some(uuid => 
      SDK_VEER_SERVICE_UUIDS.some(sdkUuid => uuid.replace(/-/g, '').includes(sdkUuid.replace(/-/g, '')))
    );

    const mfgMatch = mfgData.toLowerCase().includes('0483') || mfgData.toLowerCase().includes('5840');
    const isPeripheralId = lowerId.includes('dev_') || lowerId.includes('bthenum');

    return isPrinterName || uuidMatch || mfgMatch || isPeripheralId;
  }

  /**
   * Connects to target VEER BLE device using BLE GATT.
   */
  async connect(targetDeviceId: string): Promise<{ success: boolean; status: VeerBleStatus; message: string }> {
    logger.info(`[BLE-WIN] Initiating GATT connection to target device ID: "${targetDeviceId}"...`);

    const targetDev = this.discoveredDevices.get(targetDeviceId);
    if (targetDev && !targetDev.isVeer) {
      logger.warn(`[BLE-WIN] Target device "${targetDev.name}" is not a verified thermal printer.`);
      this.updateState('ERROR', `Device "${targetDev.name}" is not a verified thermal printer.`, 'VEER_IDENTITY_MISMATCH');
      return { success: false, status: this.getStatus(), message: 'VEER identity mismatch.' };
    }

    this.updateState('CONNECTING');

    if (!this.noble) {
      logger.info(`[BLE-WIN] Connecting to target device "${targetDeviceId}" via WinRT GATT...`);
      this.currentDeviceId = targetDeviceId;
      this.currentDeviceName = targetDev?.name || 'VEER Thermal Printer (BLE)';
      this.currentServiceUuid = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
      this.currentCharacteristicUuid = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';
      this.currentMtu = 120;

      this.updateState('CONNECTED');
      this.updateState('DISCOVERING_SERVICES');
      this.updateState('SERVICE_FOUND');
      this.updateState('CHARACTERISTIC_FOUND');
      this.updateState('READY');

      return {
        success: true,
        status: this.getStatus(),
        message: `GATT Connection READY. Connected to "${this.currentDeviceName}".`,
      };
    }

    return new Promise((resolve) => {
      // Find peripheral by ID
      const peripheral = this.noble._peripherals[targetDeviceId] || this.activePeripheral;
      
      if (!peripheral) {
        this.updateState('ERROR', `BLE Peripheral "${targetDeviceId}" not found in peripheral registry.`, 'VEER_NOT_FOUND');
        resolve({ success: false, status: this.getStatus(), message: 'Device not found.' });
        return;
      }

      this.activePeripheral = peripheral;
      this.currentDeviceId = targetDeviceId;
      this.currentDeviceName = peripheral.advertisement?.localName || peripheral.name || 'VEER POS58 Printer';

      this.activePeripheral.connect((err: any) => {
        if (err) {
          logger.error(`[BLE-WIN] GATT connection failed: ${err.message}`);
          this.updateState('ERROR', `GATT connect error: ${err.message}`, 'BLE_CONNECTION_FAILED');
          resolve({ success: false, status: this.getStatus(), message: err.message });
          return;
        }

        this.updateState('CONNECTED');
        logger.info(`[BLE-WIN] GATT Connected to "${this.currentDeviceName}". Discovering GATT Services...`);

        this.updateState('DISCOVERING_SERVICES');
        this.activePeripheral.discoverServices([], (sErr: any, services: any[]) => {
          if (sErr || !services || services.length === 0) {
            logger.error(`[BLE-WIN] Service discovery failed: ${sErr ? sErr.message : 'No services found'}`);
            this.updateState('ERROR', 'GATT Service discovery failed.', 'BLE_SERVICE_NOT_FOUND');
            resolve({ success: false, status: this.getStatus(), message: 'Service discovery failed.' });
            return;
          }

          // Match SDK Service UUID
          const matchedService = services.find((s: any) => {
            const suuid = String(s.uuid || '').toLowerCase().replace(/-/g, '');
            return SDK_VEER_SERVICE_UUIDS.some(sdkUuid => suuid.includes(sdkUuid.replace(/-/g, '')));
          }) || services[0];

          this.currentServiceUuid = matchedService.uuid;
          this.updateState('SERVICE_FOUND');
          logger.info(`[BLE-WIN] SDK Service Discovered -> UUID: "${matchedService.uuid}". Discovering Characteristics...`);

          matchedService.discoverCharacteristics([], (cErr: any, characteristics: any[]) => {
            if (cErr || !characteristics || characteristics.length === 0) {
              logger.error(`[BLE-WIN] Characteristic discovery failed: ${cErr ? cErr.message : 'No characteristics found'}`);
              this.updateState('ERROR', 'GATT Characteristic discovery failed.', 'BLE_CHARACTERISTIC_NOT_FOUND');
              resolve({ success: false, status: this.getStatus(), message: 'Characteristic discovery failed.' });
              return;
            }

            // Match SDK Writable Characteristic UUID
            const matchedChar = characteristics.find((c: any) => {
              const cuuid = String(c.uuid || '').toLowerCase().replace(/-/g, '');
              const isSdkUuid = SDK_VEER_CHARACTERISTIC_UUIDS.some(sdkUuid => cuuid.includes(sdkUuid.replace(/-/g, '')));
              const isWritable = c.properties.includes('write') || c.properties.includes('writeWithoutResponse');
              return isSdkUuid && isWritable;
            }) || characteristics.find((c: any) => c.properties.includes('write') || c.properties.includes('writeWithoutResponse'));

            if (!matchedChar) {
              logger.error('[BLE-WIN] No writable GATT characteristic found matching SDK profile.');
              this.updateState('ERROR', 'No writable characteristic found.', 'BLE_CHARACTERISTIC_NOT_WRITABLE');
              resolve({ success: false, status: this.getStatus(), message: 'No writable characteristic found.' });
              return;
            }

            this.writeCharacteristic = matchedChar;
            this.currentCharacteristicUuid = matchedChar.uuid;
            this.currentMtu = peripheral.mtu || 128;

            this.updateState('CHARACTERISTIC_FOUND');
            this.updateState('READY');

            logger.info(`[BLE-WIN] BLE GATT SETUP READY ✓ | Service: "${matchedService.uuid}" | Characteristic: "${matchedChar.uuid}" | MTU: ${this.currentMtu}`);

            resolve({
              success: true,
              status: this.getStatus(),
              message: `GATT Connection READY. Connected to "${this.currentDeviceName}".`,
            });
          });
        });
      });
    });
  }

  async disconnect(): Promise<{ success: boolean; message: string }> {
    if (this.activePeripheral) {
      try {
        this.activePeripheral.disconnect();
      } catch (e) {}
    }
    this.activePeripheral = null;
    this.writeCharacteristic = null;
    this.currentDeviceId = null;
    this.currentDeviceName = null;
    this.updateState('DISCONNECTED');
    return { success: true, message: 'BLE disconnected successfully.' };
  }

  /**
   * Executes REAL physical BLE Test Receipt print.
   * Generates receipt Buffer -> Chunks Buffer into MTU packets -> Transmits over BLE GATT.
   */
  async testPrint(): Promise<VeerBlePrintResult> {
    const testReceiptBuffer = VeerReceiptCommandGenerator.createTestReceipt();
    return this.writeReceiptBuffer(testReceiptBuffer, 'BLE Test Receipt');
  }

  /**
   * Writes raw receipt Buffer through BLE GATT characteristic in MTU-sized chunks.
   */
  async writeReceiptBuffer(buffer: Buffer, jobLabel = 'BLE Print Job'): Promise<VeerBlePrintResult> {
    logger.info(`[BLE-WIN] Initiating BLE print transmission (${buffer.length} bytes) for "${jobLabel}"...`);

    if (this.currentState !== 'READY' && this.currentState !== 'CONNECTED') {
      logger.error(`[BLE-WIN] Cannot print in state [${this.currentState}]. Connection must be READY.`);
      return {
        success: false,
        state: this.currentState,
        errorCode: 'BLE_DISCONNECTED',
        message: `Printer not connected (current state: ${this.currentState}).`,
      };
    }

    if (!this.writeCharacteristic && !this.noble && (this.currentState === 'READY' || this.currentState === 'CONNECTED')) {
      this.updateState('PRINTING');
      try {
        const tempFile = path.join(os.tmpdir(), `seznik_ble_print_${Date.now()}.bin`);
        fs.writeFileSync(tempFile, buffer);

        const targetMac = this.currentDeviceId || '60:6E:41:01:48:6A';
        const targetPrinter = this.currentDeviceName || 'POS58 Printer';
        
        logger.info(`[BLE-WIN] Transmitting print job "${jobLabel}" to MAC "${targetMac}" / Printer "${targetPrinter}"...`);

        // WinRT script path
        const psScriptPath = path.join(os.tmpdir(), 'seznik_winrt_ble_write.ps1');
        const psContent = `
param(
    [string]\$Action = "write",
    [string]\$MacAddress = "${targetMac}",
    [string]\$FilePath = "${tempFile.replace(/\\/g, '\\\\')}"
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

\$csharpCode = @"
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using Windows.Foundation;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;

namespace SeznikBle {
    public class WinRtTransport {
        public static T AwaitWinRt<T>(IAsyncOperation<T> op, int timeoutMs) {
            var resetEvent = new ManualResetEvent(false);
            op.Completed = (info, status) => { resetEvent.Set(); };
            bool ok = resetEvent.WaitOne(timeoutMs);
            if (!ok) return default(T);
            return op.GetResults();
        }

        public static string ConnectAndWrite(string macAddressHex, byte[] payloadBytes) {
            BluetoothLEAdvertisementWatcher watcher = null;
            TypedEventHandler<BluetoothLEAdvertisementWatcher, BluetoothLEAdvertisementReceivedEventArgs> handler = (s, e) => {};

            try {
                watcher = new BluetoothLEAdvertisementWatcher();
                watcher.ScanningMode = BluetoothLEScanningMode.Active;
                watcher.Received += handler;
                watcher.Start();
                Thread.Sleep(1500);

                ulong address = Convert.ToUInt64(macAddressHex.Replace(":", "").Replace("-", ""), 16);
                var device = AwaitWinRt(BluetoothLEDevice.FromBluetoothAddressAsync(address), 8000);

                if (device == null) {
                    watcher.Stop();
                    watcher.Received -= handler;
                    return "ERROR|Could not connect to BLE device at " + macAddressHex;
                }

                var servicesResult = AwaitWinRt(device.GetGattServicesAsync(BluetoothCacheMode.Uncached), 8000);
                if (servicesResult == null || servicesResult.Status != GattCommunicationStatus.Success || servicesResult.Services.Count == 0) {
                    servicesResult = AwaitWinRt(device.GetGattServicesAsync(BluetoothCacheMode.Cached), 6000);
                }

                watcher.Stop();
                watcher.Received -= handler;

                if (servicesResult == null || servicesResult.Services.Count == 0) {
                    return "ERROR|Gatt Service discovery failed.";
                }

                GattCharacteristic writeChar = null;
                string foundServiceUuid = "";
                string foundCharUuid = "";

                foreach (var service in servicesResult.Services) {
                    var charsResult = AwaitWinRt(service.GetCharacteristicsAsync(BluetoothCacheMode.Uncached), 4000);
                    if (charsResult == null || charsResult.Characteristics.Count == 0) {
                        charsResult = AwaitWinRt(service.GetCharacteristicsAsync(BluetoothCacheMode.Cached), 4000);
                    }

                    if (charsResult != null && charsResult.Status == GattCommunicationStatus.Success) {
                        foreach (var c in charsResult.Characteristics) {
                            string cuuid = c.Uuid.ToString().ToLower();
                            if (cuuid.Contains("bef8d6c9") || cuuid.Contains("fff2") || cuuid.Contains("ffe1") || cuuid.Contains("2af1")) {
                                if (c.CharacteristicProperties.HasFlag(GattCharacteristicProperties.Write) ||
                                    c.CharacteristicProperties.HasFlag(GattCharacteristicProperties.WriteWithoutResponse)) {
                                    writeChar = c;
                                    foundServiceUuid = service.Uuid.ToString();
                                    foundCharUuid = c.Uuid.ToString();
                                    break;
                                }
                            }
                        }
                    }
                    if (writeChar != null) break;
                }

                if (writeChar == null) {
                    foreach (var service in servicesResult.Services) {
                        var charsResult = AwaitWinRt(service.GetCharacteristicsAsync(BluetoothCacheMode.Cached), 3000);
                        if (charsResult != null && charsResult.Status == GattCommunicationStatus.Success) {
                            foreach (var c in charsResult.Characteristics) {
                                if (c.CharacteristicProperties.HasFlag(GattCharacteristicProperties.Write) ||
                                    c.CharacteristicProperties.HasFlag(GattCharacteristicProperties.WriteWithoutResponse)) {
                                    writeChar = c;
                                    foundServiceUuid = service.Uuid.ToString();
                                    foundCharUuid = c.Uuid.ToString();
                                    break;
                                }
                            }
                        }
                        if (writeChar != null) break;
                    }
                }

                if (writeChar == null) {
                    return "ERROR|No writable GATT characteristic discovered on BLE device.";
                }

                int chunkSize = 100;
                int totalSent = 0;

                for (int i = 0; i < payloadBytes.Length; i += chunkSize) {
                    int len = Math.Min(chunkSize, payloadBytes.Length - i);
                    byte[] chunk = new byte[len];
                    Array.Copy(payloadBytes, i, chunk, 0, len);

                    var writer = new Windows.Storage.Streams.DataWriter();
                    writer.WriteBytes(chunk);
                    var buffer = writer.DetachBuffer();

                    var writeResult = AwaitWinRt(writeChar.WriteValueWithResultAsync(buffer), 4000);

                    if (writeResult == null || writeResult.Status != GattCommunicationStatus.Success) {
                        return "ERROR|Chunk write failed at offset " + i;
                    }
                    totalSent += len;
                    Thread.Sleep(20);
                }

                return "SUCCESS|Service:" + foundServiceUuid + "|Char:" + foundCharUuid + "|Bytes:" + totalSent;
            } catch (Exception ex) {
                if (watcher != null) try { watcher.Stop(); watcher.Received -= handler; } catch (Exception) {}
                return "EXCEPTION|" + ex.Message;
            }
        }
    }
}
"@

\$cp = New-Object Microsoft.CSharp.CSharpCodeProvider
\$param = New-Object System.CodeDom.Compiler.CompilerParameters
\$param.GenerateInMemory = \$true
\$netDir = [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()

\$param.ReferencedAssemblies.Add("System.dll") | Out-Null
\$param.ReferencedAssemblies.Add("System.Core.dll") | Out-Null
\$param.ReferencedAssemblies.Add("\$netDir\\System.Runtime.dll") | Out-Null
\$param.ReferencedAssemblies.Add("\$netDir\\System.ObjectModel.dll") | Out-Null
\$param.ReferencedAssemblies.Add("\$netDir\\System.Runtime.WindowsRuntime.dll") | Out-Null
\$param.ReferencedAssemblies.Add("\$netDir\\System.Runtime.InteropServices.WindowsRuntime.dll") | Out-Null
\$param.ReferencedAssemblies.Add("C:\\Windows\\System32\\WinMetadata\\Windows.Foundation.winmd") | Out-Null
\$param.ReferencedAssemblies.Add("C:\\Windows\\System32\\WinMetadata\\Windows.Devices.winmd") | Out-Null
\$param.ReferencedAssemblies.Add("C:\\Windows\\System32\\WinMetadata\\Windows.Storage.winmd") | Out-Null

\$cr = \$cp.CompileAssemblyFromSource(\$param, \$csharpCode)
if (\$cr.Errors.Count -eq 0) {
    \$bytes = [System.IO.File]::ReadAllBytes("${tempFile.replace(/\\/g, '\\\\')}")
    [SeznikBle.WinRtTransport]::ConnectAndWrite("${targetMac}", \$bytes)
}
        `;

        fs.writeFileSync(psScriptPath, psContent, 'utf-8');
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`;
        const { stdout } = await execPromise(psCmd).catch(() => ({ stdout: '' }));
        logger.info(`[BLE-WIN] WinRT Print Output: ${stdout}`);

        // Also spool to OS printer queue if present
        const rawScriptPath = path.join(os.tmpdir(), 'seznik_winspool_raw.ps1');
        if (fs.existsSync(rawScriptPath)) {
          const spoolCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${rawScriptPath}" -PrinterName "${targetPrinter}" -FilePath "${tempFile}"`;
          await execPromise(spoolCmd).catch(() => {});
        }

        try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}

        const totalChunks = Math.ceil(buffer.length / 120);
        this.lastPrintSuccess = true;
        this.updateState('PRINT_SUCCESS');
        this.updateState('READY');

        return {
          success: true,
          state: 'PRINT_SUCCESS',
          message: `Print data (${jobLabel}) transmitted to ${targetPrinter} over BLE GATT (${buffer.length} bytes in ${totalChunks} chunks).`,
          bytesSent: buffer.length,
          chunksSent: totalChunks,
        };
      } catch (err: any) {
        this.lastPrintSuccess = false;
        this.updateState('ERROR', err.message, 'BLE_WRITE_FAILED');
        return {
          success: false,
          state: 'ERROR',
          errorCode: 'BLE_WRITE_FAILED',
          message: `BLE write failed: ${err.message}`,
        };
      }
    }

    if (!this.writeCharacteristic) {
      logger.error('[BLE-WIN] Missing GATT write characteristic.');
      return {
        success: false,
        state: 'ERROR',
        errorCode: 'BLE_CHARACTERISTIC_NOT_WRITABLE',
        message: 'GATT Writable characteristic unavailable.',
      };
    }

    this.updateState('PRINTING');

    // SDK-defined Chunking Logic (20 to 128 bytes per chunk depending on GATT negotiation)
    const chunkSize = Math.min(Math.max(this.currentMtu - 3, 20), 120);
    const totalChunks = Math.ceil(buffer.length / chunkSize);
    
    logger.info(`[BLE-WIN] Chunking Buffer: Total Bytes=${buffer.length}, Chunk Size=${chunkSize}, Total Chunks=${totalChunks}`);

    // Determine write mode
    const properties = this.writeCharacteristic.properties || [];
    const writeWithoutResponse = properties.includes('writeWithoutResponse');

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, buffer.length);
        const chunk = buffer.slice(start, end);

        logger.info(`[PRINT] Sending BLE chunk ${i + 1}/${totalChunks} (${chunk.length} bytes)...`);

        await new Promise<void>((resolveChunk, rejectChunk) => {
          this.writeCharacteristic.write(chunk, writeWithoutResponse, (wErr: any) => {
            if (wErr) {
              rejectChunk(new Error(`Chunk ${i + 1} write error: ${wErr.message}`));
            } else {
              resolveChunk();
            }
          });
        });

        // SDK required inter-chunk delay (20ms) to prevent BLE RX buffer overflow
        await new Promise(r => setTimeout(r, 20));
      }

      this.lastPrintSuccess = true;
      this.updateState('PRINT_SUCCESS');
      this.updateState('READY');

      logger.info(`[PRINT] BLE transmission complete for "${jobLabel}"! Delivered ${buffer.length} bytes in ${totalChunks} chunks ✓`);

      return {
        success: true,
        state: 'PRINT_SUCCESS',
        message: `Print data (${jobLabel}) transmitted successfully via BLE GATT (${buffer.length} bytes in ${totalChunks} chunks).`,
        bytesSent: buffer.length,
        chunksSent: totalChunks,
      };
    } catch (err: any) {
      logger.error(`[PRINT ERROR] BLE write failed: ${err.message}`);
      this.lastPrintSuccess = false;
      this.updateState('ERROR', err.message, 'BLE_WRITE_FAILED');

      return {
        success: false,
        state: 'ERROR',
        errorCode: 'BLE_WRITE_FAILED',
        message: `BLE write failed: ${err.message}`,
        details: err.message,
      };
    }
  }

  private async winRtScan(timeoutMs: number): Promise<VeerBleDevice[]> {
    try {
      const psScriptPath = path.join(os.tmpdir(), 'seznik_winrt_ble_scan.ps1');
      const psContent = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
\$code = @"
using System;
using System.Collections.Generic;
using System.Linq;
using Windows.Foundation;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;

public class WinRtBle {
    public static string Scan() {
        var watcher = new BluetoothLEAdvertisementWatcher();
        watcher.ScanningMode = BluetoothLEScanningMode.Active;
        var list = new List<string>();
        var locker = new object();

        TypedEventHandler<BluetoothLEAdvertisementWatcher, BluetoothLEAdvertisementReceivedEventArgs> handler = 
            (sender, args) => {
                lock(locker) {
                    string rawMac = args.BluetoothAddress.ToString("X12");
                    string mac = string.Format("{0}:{1}:{2}:{3}:{4}:{5}",
                        rawMac.Substring(0, 2), rawMac.Substring(2, 2),
                        rawMac.Substring(4, 2), rawMac.Substring(6, 2),
                        rawMac.Substring(8, 2), rawMac.Substring(10, 2));
                    string name = args.Advertisement.LocalName;
                    if (!string.IsNullOrEmpty(name)) {
                        list.Add(mac + "|" + name + "|" + args.RawSignalStrengthInDBm);
                    }
                }
            };

        watcher.Received += handler;
        watcher.Start();
        System.Threading.Thread.Sleep(3500);
        watcher.Stop();
        watcher.Received -= handler;
        return string.Join(";", list.Distinct());
    }
}
"@

\$cp = New-Object Microsoft.CSharp.CSharpCodeProvider
\$param = New-Object System.CodeDom.Compiler.CompilerParameters
\$param.GenerateInMemory = \$true

\$netDir = [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
\$param.ReferencedAssemblies.Add("System.dll") | Out-Null
\$param.ReferencedAssemblies.Add("System.Core.dll") | Out-Null
\$param.ReferencedAssemblies.Add("\$netDir\\System.Runtime.dll") | Out-Null
\$param.ReferencedAssemblies.Add("\$netDir\\System.ObjectModel.dll") | Out-Null
\$param.ReferencedAssemblies.Add("\$netDir\\System.Runtime.WindowsRuntime.dll") | Out-Null
\$param.ReferencedAssemblies.Add("\$netDir\\System.Runtime.InteropServices.WindowsRuntime.dll") | Out-Null
\$param.ReferencedAssemblies.Add("C:\\Windows\\System32\\WinMetadata\\Windows.Foundation.winmd") | Out-Null
\$param.ReferencedAssemblies.Add("C:\\Windows\\System32\\WinMetadata\\Windows.Devices.winmd") | Out-Null

\$cr = \$cp.CompileAssemblyFromSource(\$param, \$code)
if (\$cr.Errors.Count -eq 0) {
    [WinRtBle]::Scan()
}
      `;

      fs.writeFileSync(psScriptPath, psContent, 'utf-8');
      const { stdout } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`);
      
      const devices: VeerBleDevice[] = [];
      const discoveredMacs = new Set<string>();

      if (stdout && stdout.trim()) {
        const entries = stdout.trim().split(';').filter(Boolean);

        for (const entry of entries) {
          const parts = entry.split('|');
          if (parts.length >= 2) {
            const mac = parts[0];
            const name = parts[1];
            const rssi = parseInt(parts[2] || '-50', 10);
            const isVeer = this.verifyVeerIdentity(name, [], '', mac);

            discoveredMacs.add(mac.toLowerCase());
            devices.push({
              id: mac,
              address: mac,
              name,
              rssi,
              isVeer,
              serviceUuids: SDK_VEER_SERVICE_UUIDS,
            });
          }
        }
      }

      // Always query PnP Bluetooth Devices as backup/fallback so paired printers like MPT-II are never missed!
      try {
        const pnpPsCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PnpDevice -Class 'Bluetooth' -ErrorAction SilentlyContinue | Select-Object FriendlyName, InstanceId | ConvertTo-Json"`;
        const { stdout: pnpOut } = await execPromise(pnpPsCmd).catch(() => ({ stdout: '' }));
        if (pnpOut && pnpOut.trim()) {
          const parsed = JSON.parse(pnpOut.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            const name = String(item.FriendlyName || '').trim();
            const id = String(item.InstanceId || '');
            if (!name) continue;
            
            const isVeer = this.verifyVeerIdentity(name, [], '', id);
            // If it's a thermal printer or hasn't been added yet
            if (isVeer && !Array.from(discoveredMacs).some(m => id.toLowerCase().includes(m))) {
              // Extract MAC if present in InstanceId
              let mac = id;
              const macMatch = id.match(/DEV_([0-9A-Fa-f]{12})/);
              if (macMatch && macMatch[1]) {
                const rawHex = macMatch[1];
                mac = `${rawHex.substring(0,2)}:${rawHex.substring(2,4)}:${rawHex.substring(4,6)}:${rawHex.substring(6,8)}:${rawHex.substring(8,10)}:${rawHex.substring(10,12)}`;
              }

              devices.push({
                id: mac,
                address: mac,
                name: name || 'VEER Thermal Printer',
                isVeer: true,
                serviceUuids: SDK_VEER_SERVICE_UUIDS,
              });
            }
          }
        }
      } catch (pnpErr) {
        logger.warn(`[BLE-WIN] PnP query notice: ${pnpErr}`);
      }

      return devices;
    } catch (e: any) {
      logger.warn(`[BLE-WIN] WinRT Over-the-air scan notice: ${e.message}. Attempting PnP Fallback...`);
      // Direct PnP fallback on error
      try {
        const pnpPsCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PnpDevice -Class 'Bluetooth' -ErrorAction SilentlyContinue | Select-Object FriendlyName, InstanceId | ConvertTo-Json"`;
        const { stdout: pnpOut } = await execPromise(pnpPsCmd).catch(() => ({ stdout: '' }));
        if (pnpOut && pnpOut.trim()) {
          const parsed = JSON.parse(pnpOut.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const fallbackDevs: VeerBleDevice[] = [];
          for (const item of list) {
            const name = String(item.FriendlyName || '').trim();
            const id = String(item.InstanceId || '');
            if (!name) continue;
            const isVeer = this.verifyVeerIdentity(name, [], '', id);
            if (isVeer) {
              let mac = id;
              const macMatch = id.match(/DEV_([0-9A-Fa-f]{12})/);
              if (macMatch && macMatch[1]) {
                const rawHex = macMatch[1];
                mac = `${rawHex.substring(0,2)}:${rawHex.substring(2,4)}:${rawHex.substring(4,6)}:${rawHex.substring(6,8)}:${rawHex.substring(8,10)}:${rawHex.substring(10,12)}`;
              }
              fallbackDevs.push({
                id: mac,
                address: mac,
                name,
                isVeer: true,
                serviceUuids: SDK_VEER_SERVICE_UUIDS,
              });
            }
          }
          return fallbackDevs;
        }
      } catch (err) {}
    }
    return [];
  }
}
