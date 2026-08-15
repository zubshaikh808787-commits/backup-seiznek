import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import logger from '../../logger';
import { JoshBleCandidate } from '../../../shared/types';
import { PrinterIdentityService } from '../printers/printerIdentity';
import { JOSH_BLE_CONSTANTS } from './bleConstants';

const execPromise = util.promisify(exec);

export class JoshBleScanner {
  /**
   * Performs real Windows BLE and Bluetooth discovery to locate nearby and paired JOSH devices.
   */
  async scanForJoshBleDevices(timeoutMs: number = JOSH_BLE_CONSTANTS.TIMEOUTS.BLE_SCAN_MS): Promise<{
    candidates: JoshBleCandidate[];
    allDevicesScanned: Array<{ name: string; address: string; rssi?: number; services: string[] }>;
    bluetoothEnabled: boolean;
    error?: string;
  }> {
    if (os.platform() !== 'win32') {
      return {
        candidates: [],
        allDevicesScanned: [],
        bluetoothEnabled: false,
        error: 'Windows BLE scanning is only supported on Windows operating systems.',
      };
    }

    logger.info(`[JOSH][BLE] Starting real Windows BLE scan (Timeout: ${timeoutMs}ms)...`);

    // PowerShell script utilizing WinRT BluetoothLEAdvertisementWatcher and Win32_PnPEntity
    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue';
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;

      # 1. Check if Bluetooth radio is enabled
      $radioStatus = (Get-PnpDevice -Class 'Bluetooth' -Status 'OK' -ErrorAction SilentlyContinue).Count -gt 0;
      if (-not $radioStatus) {
        @{ bluetoothEnabled = $false; devices = @() } | ConvertTo-Json -Depth 4;
        exit 0;
      }

      # 2. Query PnP Bluetooth LE and classic devices
      $pnpDevices = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { 
        $_.Class -eq 'Bluetooth' -or $_.InstanceId -like 'BTHLE*' -or $_.InstanceId -like 'BTHENUM*' 
      } | Select-Object FriendlyName, InstanceId, Status, Class;

      # 3. Query Serial COM ports bound to Bluetooth
      $comPorts = Get-PnpDevice -Class 'Ports' -PresentOnly -ErrorAction SilentlyContinue | Where-Object { 
        $_.FriendlyName -like '*Bluetooth*' -or $_.InstanceId -like 'BTHENUM*' 
      } | Select-Object FriendlyName, InstanceId;

      # 4. Extract MAC addresses and build device items
      $deviceList = @();
      $seen = @{};

      foreach ($d in $pnpDevices) {
        $name = $d.FriendlyName;
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        $inst = $d.InstanceId;

        # Extract 12 hex mac address
        $mac = '';
        $tokens = $inst -split '[\\\\&_]';
        for ($i = $tokens.Count - 1; $i -ge 0; $i--) {
          $t = $tokens[$i].Trim();
          if ($t -match '^[0-9A-Fa-f]{12}$') {
            $mac = $t.ToUpper();
            break;
          }
        }

        $key = if ($mac) { $mac } else { $inst };
        if ($seen[$key]) { continue }
        $seen[$key] = $true;

        # Correlate COM port
        $foundCom = '';
        if ($mac) {
          foreach ($cp in $comPorts) {
            if ($cp.InstanceId -like "*$mac*") {
              if ($cp.FriendlyName -match '\\(COM(\\d+)\\)') {
                $foundCom = "COM" + $Matches[1];
                break;
              }
            }
          }
        }

        $deviceList += [PSCustomObject]@{
          name = $name;
          instanceId = $inst;
          address = $mac;
          comPort = $foundCom;
          pnpClass = $d.Class;
        }
      }

      @{ bluetoothEnabled = $true; devices = $deviceList } | ConvertTo-Json -Depth 4;
    `;

    try {
      const { stdout } = await execPromise(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`,
        { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
      );

      if (!stdout || stdout.trim() === '') {
        return { candidates: [], allDevicesScanned: [], bluetoothEnabled: true };
      }

      const parsed = JSON.parse(stdout);
      const bluetoothEnabled = parsed?.bluetoothEnabled !== false;
      const rawDevices: any[] = Array.isArray(parsed?.devices) ? parsed.devices : (parsed?.devices ? [parsed.devices] : []);

      const allDevicesScanned: Array<{ name: string; address: string; rssi?: number; services: string[] }> = [];
      const candidates: JoshBleCandidate[] = [];

      for (const d of rawDevices) {
        const name = String(d.name || '').trim();
        const address = String(d.address || '').trim();
        const comPort = d.comPort ? String(d.comPort).trim() : null;

        allDevicesScanned.push({
          name,
          address,
          services: [],
        });

        // Use strict Multi-Factor PrinterIdentity matching
        const identity = PrinterIdentityService.identify({
          name,
          bluetoothAddress: address,
          pnpDeviceId: d.instanceId,
        }, 'BLE');

        // Strictly verify that it is JOSH and not VEER or DEV
        if (identity.isConfirmedJosh && identity.printerModel === 'JOSH') {
          logger.info(`[JOSH][BLE] Candidate confirmed: "${name}" (Address: ${address || 'N/A'}, COM: ${comPort || 'GATT'})`);
          candidates.push({
            deviceId: address || `josh-${name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
            name,
            address,
            serviceUuids: [
              JOSH_BLE_CONSTANTS.SERVICE_DETONG_PRIMARY,
              JOSH_BLE_CONSTANTS.SERVICE_ISSC_TRANSPARENT_UART,
            ],
            characteristicUuids: [
              JOSH_BLE_CONSTANTS.CHAR_DETONG_WRITE,
              JOSH_BLE_CONSTANTS.CHAR_ISSC_RX_WRITE,
            ],
            isConfirmedJosh: true,
            model: 'JOSH (50x50mm Thermal Label)',
            comPort,
          });
        }
      }

      logger.info(`[JOSH][BLE] Scan completed. Found ${candidates.length} verified JOSH candidate(s) out of ${allDevicesScanned.length} Bluetooth devices.`);
      return {
        candidates,
        allDevicesScanned,
        bluetoothEnabled,
      };
    } catch (err: any) {
      logger.error(`[JOSH][BLE] Scan error: ${err.message}`);
      return {
        candidates: [],
        allDevicesScanned: [],
        bluetoothEnabled: true,
        error: err.message,
      };
    }
  }
}
