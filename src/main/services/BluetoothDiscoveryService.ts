import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import logger from '../logger';
import { BluetoothPairedDevice } from '../../shared/types';

const execPromise = util.promisify(exec);

// Keywords that suggest a paired Bluetooth device is a printer, so it can be
// surfaced first in the picker. Mirrors the keyword heuristics already used
// by PrinterIdentificationService for USB hardware.
const PRINTER_KEYWORDS = [
  'printer', 'print', 'pos', 'pos58', 'pos-58', 'veer', 'receipt', 'thermal',
  'esc/pos', 'escpos', 'bt-', 'spp', 'label', 'olivetti', 'xprinter', 'zjiang',
  'gprinter', 'mtp', 'mpt', 'goojprt', 'rpp',
];

// Devices that are never printers — filtered out so the picker isn't cluttered
// with phones, headsets, watches, etc.
const NON_PRINTER_KEYWORDS = [
  'headphone', 'headset', 'earbud', 'earphone', 'airpod', 'speaker', 'mouse',
  'keyboard', 'watch', 'band', 'phone', 'iphone', 'galaxy', 'tv', 'display',
  'monitor', 'controller', 'gamepad', 'buds', 'car', 'audio',
];

interface RawPnpEntry {
  FriendlyName?: string;
  InstanceId?: string;
  Status?: string;
}

export class BluetoothDiscoveryService {
  /**
   * Extracts a 12-hex-digit Bluetooth MAC address from a Windows PnP
   * InstanceId. The classic SPP service UUID (00001101-...-00805f9b34fb)
   * appears in almost every Bluetooth InstanceId and must NOT be mistaken
   * for the address, so we only accept a token that is a clean 12-hex run
   * with no hyphens (the UUID's segments all contain hyphens).
   */
  private extractMacAddress(instanceId: string): string | null {
    if (!instanceId) return null;
    const tokens = instanceId.split(/[\\&_]/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i].trim().toUpperCase();
      if (/^[0-9A-F]{12}$/.test(t) && t !== '000000000000' && t !== 'FFFFFFFFFFFF') {
        return t;
      }
    }
    return null;
  }

  private isLikelyPrinter(name: string): boolean {
    const lower = name.toLowerCase();
    if (NON_PRINTER_KEYWORDS.some(k => lower.includes(k))) return false;
    return PRINTER_KEYWORDS.some(k => lower.includes(k));
  }

  /**
   * Lists paired Bluetooth devices (both Classic "Bluetooth" class and
   * "BTHLEDevice" class — Windows sometimes buckets a printer's parent
   * device under either depending on how it advertised during pairing).
   */
  private async scanPairedBluetoothDevices(): Promise<RawPnpEntry[]> {
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $a = Get-PnpDevice -Class Bluetooth -PresentOnly -ErrorAction SilentlyContinue; $b = Get-PnpDevice -Class BTHLEDevice -PresentOnly -ErrorAction SilentlyContinue; @($a; $b) | Where-Object { $_.InstanceId -notlike 'BTH\\\\MS_BTHPAN*' } | Select-Object FriendlyName, InstanceId, Status | ConvertTo-Json"`;

    try {
      const { stdout } = await execPromise(psCmd, { maxBuffer: 10 * 1024 * 1024 });
      if (!stdout || stdout.trim() === '') return [];
      const parsed = JSON.parse(stdout);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err: any) {
      logger.warn(`[BluetoothDiscoveryService] Paired device scan notice: ${err.message}`);
      return [];
    }
  }

  /**
   * Lists Windows "Ports" class devices that are Bluetooth Serial Port
   * Profile bindings — these are the actual COM ports we can write raw
   * ESC/POS bytes to (e.g. "Standard Serial over Bluetooth link (COM5)").
   */
  private async scanBluetoothComPorts(): Promise<RawPnpEntry[]> {
    const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PnpDevice -Class Ports -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -like '*Bluetooth*' -or $_.InstanceId -like 'BTHENUM*' } | Select-Object FriendlyName, InstanceId, Status | ConvertTo-Json"`;

    try {
      const { stdout } = await execPromise(psCmd, { maxBuffer: 10 * 1024 * 1024 });
      if (!stdout || stdout.trim() === '') return [];
      const parsed = JSON.parse(stdout);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err: any) {
      logger.warn(`[BluetoothDiscoveryService] Bluetooth COM port scan notice: ${err.message}`);
      return [];
    }
  }

  /**
   * Returns every paired Bluetooth device, with its bound SPP COM port
   * resolved where Windows has one (correlated by shared MAC address).
   * Devices are sorted with likely-printer matches first.
   */
  async getPairedDevices(): Promise<BluetoothPairedDevice[]> {
    if (os.platform() !== 'win32') {
      logger.warn('[BluetoothDiscoveryService] Bluetooth SPP pairing is only implemented for Windows.');
      return [];
    }

    const [pairedRaw, portsRaw] = await Promise.all([
      this.scanPairedBluetoothDevices(),
      this.scanBluetoothComPorts(),
    ]);

    // Build a map of MAC address / Port Name -> COM port name from the Ports class scan
    const macToComPort = new Map<string, string>();
    const availableComPorts: string[] = [];

    for (const p of portsRaw) {
      const instanceId = p.InstanceId || '';
      const friendly = p.FriendlyName || '';
      const comMatch = friendly.match(/\(COM(\d+)\)/i);
      if (!comMatch) continue;
      const comPort = `COM${comMatch[1]}`;

      // Ignore dummy/inbound local endpoints with 000000000000
      if (instanceId.includes('000000000000')) {
        continue;
      }

      availableComPorts.push(comPort);

      const mac = this.extractMacAddress(instanceId);
      if (mac) macToComPort.set(mac, comPort);
    }

    const seen = new Set<string>();
    const devices: BluetoothPairedDevice[] = [];

    for (const d of pairedRaw) {
      const name = (d.FriendlyName || '').trim();
      if (!name) continue;

      const lowerName = name.toLowerCase();
      if (
        lowerName.includes('bluetooth device (personal area network)') ||
        lowerName.includes('bluetooth peripheral device') ||
        lowerName === 'bluetooth radio' ||
        lowerName.includes('generic bluetooth')
      ) continue;

      const instanceId = d.InstanceId || '';
      const mac = this.extractMacAddress(instanceId);
      const dedupeKey = mac || instanceId || name;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      let comPort = mac ? macToComPort.get(mac) || null : null;
      
      // Fallback: If MAC correlation missed but Bluetooth COM ports are available, pick the available COM port
      if (!comPort && availableComPorts.length > 0) {
        comPort = availableComPorts[0];
      }

      devices.push({
        id: mac || `bt-${name.replace(/\s+/g, '-').toLowerCase()}`,
        name,
        address: mac,
        comPort,
        isLikelyPrinter: this.isLikelyPrinter(name),
      });
    }

    // Also surface any Bluetooth COM port whose parent device didn't show up
    // in the Bluetooth-class scan (some drivers only expose the Ports entry).
    for (const p of portsRaw) {
      const friendly = (p.FriendlyName || '').trim();
      const instanceId = p.InstanceId || '';
      const mac = this.extractMacAddress(instanceId);
      if (mac && seen.has(mac)) continue;
      const comMatch = friendly.match(/\(COM(\d+)\)/i);
      if (!comMatch) continue;
      const comPort = `COM${comMatch[1]}`;
      const dedupeKey = mac || instanceId;
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      devices.push({
        id: mac || `bt-port-${comPort.toLowerCase()}`,
        name: friendly.replace(/\s*\(COM\d+\)\s*$/i, '') || `Bluetooth Serial Device (${comPort})`,
        address: mac,
        comPort,
        isLikelyPrinter: this.isLikelyPrinter(friendly),
      });
    }

    devices.sort((a, b) => {
      if (a.isLikelyPrinter !== b.isLikelyPrinter) return a.isLikelyPrinter ? -1 : 1;
      if (!!a.comPort !== !!b.comPort) return a.comPort ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    logger.info(`[BluetoothDiscoveryService] Found ${devices.length} paired Bluetooth device(s), ${devices.filter(d => d.comPort).length} with a resolved SPP COM port.`);
    return devices;
  }
}
