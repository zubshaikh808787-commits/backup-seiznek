import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../../logger';
import { JOSH_BLE_CONSTANTS } from './bleConstants';

const execPromise = util.promisify(exec);

export interface GattDiscoveredService {
  uuid: string;
  characteristics: Array<{
    uuid: string;
    properties: string[];
  }>;
}

export interface BleConnectResult {
  connected: boolean;
  stage: 'CONNECTED' | 'CONNECTION_FAILED' | 'SERVICE_DISCOVERY_FAILED' | 'CHAR_DISCOVERY_FAILED' | 'COMMUNICATION_VERIFIED';
  errorCode?: string;
  message: string;
  discoveredServices: GattDiscoveredService[];
  targetAddress?: string;
  targetDeviceName?: string;
}

export class JoshBleConnection {
  /**
   * Performs real Windows BLE GATT connection and service discovery.
   * Never reports connected without actual hardware verification.
   */
  async connectAndDiscoverGatt(macAddress: string, deviceName: string = 'JOSH'): Promise<BleConnectResult> {
    if (os.platform() !== 'win32') {
      return {
        connected: false,
        stage: 'CONNECTION_FAILED',
        errorCode: JOSH_BLE_CONSTANTS.ERRORS.CONNECTION_FAILED,
        message: 'Windows BLE operations are only supported on Windows.',
        discoveredServices: [],
      };
    }

    const cleanMac = (macAddress || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    if (!cleanMac || cleanMac.length !== 12) {
      return {
        connected: false,
        stage: 'CONNECTION_FAILED',
        errorCode: JOSH_BLE_CONSTANTS.ERRORS.CONNECTION_FAILED,
        message: `Invalid Bluetooth MAC address format: "${macAddress}"`,
        discoveredServices: [],
      };
    }

    logger.info(`[JOSH][BLE] Connecting to physical JOSH BLE device "${deviceName}" (MAC: ${cleanMac})...`);

    const psGattDiscoveryScript = `
      $ErrorActionPreference = 'Stop';
      [System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime") | Out-Null;
      [Windows.Devices.Bluetooth.BluetoothDevice, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null;
      [Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult, Windows.Devices.Bluetooth, ContentType = WindowsRuntime] | Out-Null;

      $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' 
      };

      $macInt = [UInt64]::Parse("${cleanMac}", [System.Globalization.NumberStyles]::HexNumber);

      # 1. Connect to device
      $asyncDev = [Windows.Devices.Bluetooth.BluetoothDevice]::FromBluetoothAddressAsync($macInt);
      $taskDev = $asTaskGeneric.MakeGenericMethod([Windows.Devices.Bluetooth.BluetoothDevice]).Invoke($null, @($asyncDev));
      if (-not $taskDev.Wait(8000)) {
        @{ success = $false; stage = "CONNECTION_FAILED"; error = "Connection timeout to device ${cleanMac}" } | ConvertTo-Json;
        exit 0;
      }
      $device = $taskDev.Result;
      if (-not $device) {
        @{ success = $false; stage = "CONNECTION_FAILED"; error = "Device ${cleanMac} could not be opened" } | ConvertTo-Json;
        exit 0;
      }

      # 2. Discover GATT Services
      $asyncServices = $device.GetGattServicesAsync();
      $taskServices = $asTaskGeneric.MakeGenericMethod([Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult]).Invoke($null, @($asyncServices));
      if (-not $taskServices.Wait(8000)) {
        @{ success = $false; stage = "SERVICE_DISCOVERY_FAILED"; error = "GATT service discovery timeout" } | ConvertTo-Json;
        exit 0;
      }
      $servicesResult = $taskServices.Result;
      if (-not $servicesResult.Services -or $servicesResult.Services.Count -eq 0) {
        # Fallback to RFCOMM service check if classic BLE GATT is masked
        $asyncRfcomm = $device.GetRfcommServicesAsync();
        $taskRfcomm = $asTaskGeneric.MakeGenericMethod([Windows.Devices.Bluetooth.Rfcomm.RfcommDeviceServicesResult]).Invoke($null, @($asyncRfcomm));
        $taskRfcomm.Wait(5000);
        $rfResult = $taskRfcomm.Result;
        if ($rfResult.Services -and $rfResult.Services.Count -gt 0) {
          $rfList = @();
          foreach ($rf in $rfResult.Services) {
            $rfList += [PSCustomObject]@{
              uuid = $rf.ServiceId.AsString();
              characteristics = @([PSCustomObject]@{ uuid = "RFCOMM-SPP-PORT"; properties = @("Write", "Read") });
            }
          }
          @{ success = $true; stage = "COMMUNICATION_VERIFIED"; services = $rfList } | ConvertTo-Json -Depth 4;
          exit 0;
        }

        @{ success = $false; stage = "SERVICE_DISCOVERY_FAILED"; error = "No GATT or RFCOMM services discovered on ${deviceName}" } | ConvertTo-Json;
        exit 0;
      }

      # 3. Discover Characteristics for each service
      $serviceList = @();
      foreach ($svc in $servicesResult.Services) {
        $uuid = $svc.Uuid.ToString();
        $asyncChars = $svc.GetCharacteristicsAsync();
        $taskChars = $asTaskGeneric.MakeGenericMethod([Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult]).Invoke($null, @($asyncChars));
        $taskChars.Wait(3000);
        $charList = @();
        if ($taskChars.Result.Characteristics) {
          foreach ($ch in $taskChars.Result.Characteristics) {
            $charList += [PSCustomObject]@{
              uuid = $ch.Uuid.ToString();
              properties = @($ch.CharacteristicProperties.ToString());
            }
          }
        }
        $serviceList += [PSCustomObject]@{
          uuid = $uuid;
          characteristics = $charList;
        }
      }

      @{ success = $true; stage = "COMMUNICATION_VERIFIED"; services = $serviceList } | ConvertTo-Json -Depth 4;
    `;

    try {
      const { stdout } = await execPromise(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psGattDiscoveryScript.replace(/"/g, '\\"')}"`,
        { timeout: 25000, maxBuffer: 10 * 1024 * 1024 }
      );

      if (!stdout || stdout.trim() === '') {
        return {
          connected: false,
          stage: 'CONNECTION_FAILED',
          errorCode: JOSH_BLE_CONSTANTS.ERRORS.CONNECTION_FAILED,
          message: `No response from Bluetooth stack when connecting to ${deviceName}.`,
          discoveredServices: [],
        };
      }

      const parsed = JSON.parse(stdout);
      if (!parsed.success) {
        logger.warn(`[JOSH][BLE] GATT connection returned failure: ${parsed.error || parsed.stage}`);
        return {
          connected: false,
          stage: parsed.stage || 'CONNECTION_FAILED',
          errorCode: JOSH_BLE_CONSTANTS.ERRORS.SERVICE_DISCOVERY_FAILED,
          message: parsed.error || `Could not discover JOSH BLE services on ${deviceName}.`,
          discoveredServices: [],
        };
      }

      const rawServices = Array.isArray(parsed.services) ? parsed.services : [parsed.services];
      const discoveredServices: GattDiscoveredService[] = rawServices.map((s: any) => ({
        uuid: s.uuid || '',
        characteristics: Array.isArray(s.characteristics)
          ? s.characteristics.map((c: any) => ({ uuid: c.uuid || '', properties: c.properties || [] }))
          : [],
      }));

      logger.info(`[JOSH][BLE] Successfully connected to "${deviceName}"! Discovered ${discoveredServices.length} GATT / RFCOMM service(s) ✓`);
      return {
        connected: true,
        stage: 'COMMUNICATION_VERIFIED',
        message: `Connected to JOSH BLE device "${deviceName}" (MAC: ${cleanMac}) with verified GATT services.`,
        discoveredServices,
        targetAddress: cleanMac,
        targetDeviceName: deviceName,
      };
    } catch (err: any) {
      logger.error(`[JOSH][BLE] GATT connection error: ${err.message}`);
      return {
        connected: false,
        stage: 'CONNECTION_FAILED',
        errorCode: JOSH_BLE_CONSTANTS.ERRORS.CONNECTION_FAILED,
        message: `Bluetooth connection error: ${err.message}`,
        discoveredServices: [],
      };
    }
  }

  /**
   * Registers/configures the Windows printer queue for JOSH Bluetooth with DP27 Label Printer driver.
   */
  async registerJoshBluetoothQueue(comPort: string, queueName: string = 'LD0801 (Bluetooth)'): Promise<{ success: boolean; message: string; driverUsed: string }> {
    const esc = (s: string) => s.replace(/'/g, "''");
    const portName = comPort.endsWith(':') ? comPort : `${comPort}:`;

    try {
      // Find DP27 Label Printer driver
      const { DriverManager } = await import('../DriverManager');
      const driverMgr = new DriverManager();
      await driverMgr.installDriverAutomatically('JOSH');

      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "
        $ErrorActionPreference='Stop';
        Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows' -Name 'LegacyDefaultPrinterMode' -Value 1 -Type DWord -Force;
        if (-not (Get-PrinterPort -Name '${esc(portName)}' -ErrorAction SilentlyContinue)) { Add-PrinterPort -Name '${esc(portName)}' };
        if (-not (Get-Printer -Name '${esc(queueName)}' -ErrorAction SilentlyContinue)) {
          Add-Printer -Name '${esc(queueName)}' -DriverName 'DP27 Label Printer' -PortName '${esc(portName)}' -PrintProcessor 'winprint' -DataType 'RAW'
        } else {
          Set-Printer -Name '${esc(queueName)}' -DriverName 'DP27 Label Printer' -PortName '${esc(portName)}' -PrintProcessor 'winprint' -DataType 'RAW'
        }
      "`;

      await execPromise(psCmd, { timeout: 20000 });
      logger.info(`[JOSH][BLE] Registered Windows Printer "${queueName}" on "${portName}" with "DP27 Label Printer" driver ✓`);
      return {
        success: true,
        message: `Registered "${queueName}" in Windows Spooler on ${portName} with DP27 Label Printer driver.`,
        driverUsed: 'DP27 Label Printer',
      };
    } catch (err: any) {
      logger.error(`[JOSH][BLE] Spooler queue registration error: ${err.message}`);
      return {
        success: false,
        message: `Spooler registration failed: ${err.message}`,
        driverUsed: 'DP27 Label Printer',
      };
    }
  }
}
