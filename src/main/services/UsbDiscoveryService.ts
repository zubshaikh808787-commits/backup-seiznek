import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import logger from '../logger';

const execPromise = util.promisify(exec);

export interface DetectedUsbHardware {
  name: string;
  vendorId: string | null;
  productId: string | null;
  pnpDeviceId: string;
  service: string;
  isPrinterClass: boolean;
}

export class UsbDiscoveryService {
  private isMonitoring = false;
  private isScanning = false;
  private monitorTimer: NodeJS.Timeout | null = null;

  /**
   * Scans real OS USB controller and PnP entities for physically attached USB printers.
   * NO fake or mock data! Returns empty list if no printer attached.
   */
  async scanPhysicalUsbDevices(): Promise<DetectedUsbHardware[]> {
    if (os.platform() === 'win32') {
      return this.scanWindowsUsbDevices();
    } else {
      return this.scanMacUsbDevices();
    }
  }

  private async scanWindowsUsbDevices(): Promise<DetectedUsbHardware[]> {
    try {
      const detected: DetectedUsbHardware[] = [];
      const seenIds = new Set<string>();

      // ==========================================
      // PHASE 1: Physical USB PnP Bus Scan (Fast Targeted PnP Query)
      // Detects printers that register as usbprint/usbser service devices
      // ==========================================
      const psPnpCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.Class -eq 'Printer' -or $_.InstanceId -like '*USBPRINT*' -or $_.InstanceId -like '*VID_3533*' -or $_.InstanceId -like '*VID_0416*' -or $_.InstanceId -like '*POS58*' -or $_.Service -eq 'usbprint' -or $_.FriendlyName -like '*LD0801*' -or $_.FriendlyName -like '*DP27*' } | Select-Object FriendlyName, Name, Caption, InstanceId, PNPDeviceID, Class, PNPClass, Service | ConvertTo-Json"`;
      
      const { stdout: pnpStdout } = await execPromise(psPnpCommand, { maxBuffer: 10 * 1024 * 1024 });
      if (pnpStdout && pnpStdout.trim() !== '') {
        try {
          const parsed = JSON.parse(pnpStdout);
          const list: any[] = Array.isArray(parsed) ? parsed : [parsed];

          for (const item of list) {
            const name = String(item.FriendlyName || item.Name || item.Caption || '').trim();
            const pnpId = String(item.InstanceId || item.PNPDeviceID || '').toUpperCase();
            const pnpClass = String(item.Class || item.PNPClass || '').toLowerCase();
            const service = String(item.Service || '').toLowerCase();
            const lowerName = name.toLowerCase();

            // Ignore internal motherboard system infra, webcams, bluetooth, audio, hid mouse/keyboard
            if (
              lowerName.includes('host controller') ||
              lowerName.includes('root hub') ||
              lowerName.includes('generic usb hub') ||
              lowerName.includes('extensible host') ||
              lowerName.includes('pci standard') ||
              lowerName.includes('bluetooth') ||
              lowerName.includes('camera') ||
              lowerName.includes('audio') ||
              lowerName.includes('mouse') ||
              lowerName.includes('keyboard') ||
              lowerName.includes('input device') ||
              pnpClass === 'hidclass' ||
              lowerName.includes('acpi') ||
              lowerName.includes('thermal zone') ||
              lowerName.includes('unknown usb device') ||
              pnpId.startsWith('ROOT\\') ||
              pnpId.startsWith('SWD\\')
            ) continue;

            if (name === 'Root Print Queue') continue;

            const isPhysicalUsbDevice = pnpId.startsWith('USB\\') || pnpId.startsWith('USBPRINT\\');
            if (!isPhysicalUsbDevice && service !== 'usbprint') continue;

            if (lowerName === 'usb composite device' && service !== 'usbprint' && service !== 'usbser') {
              continue;
            }

            const isPrinterHardware = 
              service === 'usbprint' ||
              service === 'usbser' ||
              service === 'silabser' ||
              service === 'ch341ser' ||
              service === 'ftser2k' ||
              pnpClass === 'printer' ||
              pnpId.startsWith('USBPRINT') ||
              lowerName.includes('printing support') ||
              lowerName.includes('pos') ||
              lowerName.includes('receipt') ||
              lowerName.includes('label') ||
              lowerName.includes('josh') ||
              lowerName.includes('veer') ||
              lowerName.includes('dev') ||
              lowerName.includes('dp27') ||
              lowerName.includes('detong') ||
              lowerName.includes('ld0801') ||
              lowerName.includes('pos58') ||
              lowerName.includes('pos80') ||
              lowerName.includes('sz-80d') ||
              lowerName.includes('xprinter') ||
              lowerName.includes('zjiang') ||
              lowerName.includes('gprinter') ||
              lowerName.includes('tsc') ||
              lowerName.includes('dothantech') ||
              lowerName.includes('dtpweb');

            if (isPrinterHardware) {
              const vidMatch = pnpId.match(/VID_([0-9A-F]{4})/i);
              const pidMatch = pnpId.match(/PID_([0-9A-F]{4})/i);

              const vendorId = vidMatch ? `0x${vidMatch[1]}` : null;
              const productId = pidMatch ? `0x${pidMatch[1]}` : null;

              if (!seenIds.has(pnpId)) {
                seenIds.add(pnpId);
                detected.push({
                  name: name || 'USB Thermal Printer',
                  vendorId,
                  productId,
                  pnpDeviceId: pnpId,
                  service: item.Service || '',
                  isPrinterClass: true,
                });
              }
            }
          }
        } catch (e: any) {
          logger.warn(`[UsbDiscoveryService] Error parsing PnP JSON: ${e.message}`);
        }
      }

      // If physical PnP hardware is detected on USB bus, return it immediately to prevent old spooler queues from overriding it!
      const physicalPnpDevices = detected.filter(d => d.pnpDeviceId.startsWith('USB\\') || d.pnpDeviceId.startsWith('USBPRINT\\'));
      if (physicalPnpDevices.length > 0) {
        logger.info(`[UsbDiscoveryService] Phase 1 detected ${physicalPnpDevices.length} physical PnP USB hardware device(s) on USB bus.`);
        return physicalPnpDevices;
      }

      // ==========================================
      // PHASE 2: Active USB Printer Port Detection (Fallback)
      // ==========================================
      try {
        // Get all printer ports with their descriptions
        const psPortsCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-PrinterPort -ErrorAction SilentlyContinue | Select-Object Name, Description, PortMonitor | ConvertTo-Json"`;
        const { stdout: portsStdout } = await execPromise(psPortsCommand);
        
        // Get all printer queues
        const psPrinterCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json"`;
        const { stdout: printerStdout } = await execPromise(psPrinterCommand);

        if (portsStdout && printerStdout) {
          const parsedPorts = JSON.parse(portsStdout || '[]');
          const portList: any[] = Array.isArray(parsedPorts) ? parsedPorts : [parsedPorts];

          const parsedPrinters = JSON.parse(printerStdout || '[]');
          const printerList: any[] = Array.isArray(parsedPrinters) ? parsedPrinters : [parsedPrinters];

          // Build a set of active USB printer port names (USB001, USB002, CP001, etc.)
          const activeUsbPorts = new Set<string>();
          for (const port of portList) {
            const portName = String(port.Name || '').toUpperCase();
            const portDesc = String(port.Description || '').toLowerCase();
            const portMonitor = String(port.PortMonitor || '').toLowerCase();

            // Active USB printer ports have descriptions like "USBPort", "DeTong DP27 Label Printer", "OLIVETTIPRT80"
            // or port monitors like "Common Port", "Dynamic Print Monitor"
            const isUsbPrinterPort = (
              portName.startsWith('USB') ||
              portName.startsWith('CP') ||
              portDesc.includes('usbport') ||
              portDesc.includes('detong') ||
              portDesc.includes('dp27') ||
              portDesc.includes('pos') ||
              portDesc.includes('label') ||
              portDesc.includes('olivetti') ||
              portDesc.includes('thermal') ||
              portMonitor.includes('dynamic print') ||
              portMonitor.includes('common port')
            );

            // Exclude standard system ports (COM1-6, LPT1-3, FILE, nul, PORTPROMPT)
            const isSystemPort = (
              portName.startsWith('COM') ||
              portName.startsWith('LPT') ||
              portName === 'FILE:' ||
              portName === 'NUL:' ||
              portName === 'PORTPROMPT:'
            );

            if (isUsbPrinterPort && !isSystemPort) {
              activeUsbPorts.add(portName);
              logger.info(`[UsbDiscoveryService] Active USB printer port found: ${portName} (${port.Description || 'USB'})`);
            }
          }

          // Match printer queues to active USB ports
          for (const prt of printerList) {
            const pName = String(prt.Name || '').trim();
            const driverName = String(prt.DriverName || '').trim();
            const portName = String(prt.PortName || '').toUpperCase();
            const lowerPName = pName.toLowerCase();

            // Ignore software printers
            if (
              lowerPName.includes('pdf') ||
              lowerPName.includes('xps') ||
              lowerPName.includes('fax') ||
              lowerPName.includes('onenote')
            ) continue;

            // Must be on an active USB printer port
            if (!activeUsbPorts.has(portName)) continue;

            // Build a unique key for this printer
            const uniqueKey = `PORT_${portName}_${pName.toUpperCase()}`;
            if (seenIds.has(uniqueKey)) continue;
            seenIds.add(uniqueKey);

            detected.push({
              name: pName,
              vendorId: null,
              productId: null,
              pnpDeviceId: uniqueKey,
              service: driverName,
              isPrinterClass: true,
            });

            logger.info(`[UsbDiscoveryService] Detected USB printer via port: "${pName}" (Driver: ${driverName}, Port: ${portName})`);
          }
        }
      } catch (e: any) {
        logger.warn(`[UsbDiscoveryService] Phase 2 port scan error: ${e.message}`);
      }

      logger.info(`[UsbDiscoveryService] Total USB printer(s) detected: ${detected.length}`);
      return detected;
    } catch (err: any) {
      logger.error(`Error in scanWindowsUsbDevices: ${err.message}`);
      return [];
    }
  }

  private async scanMacUsbDevices(): Promise<DetectedUsbHardware[]> {
    try {
      const { stdout } = await execPromise('system_profiler SPUSBDataType -json');
      if (!stdout || stdout.trim() === '') return [];

      const parsed = JSON.parse(stdout);
      const items: any[] = parsed.SPUSBDataType || [];
      const detected: DetectedUsbHardware[] = [];

      const walkUsbTree = (nodes: any[]) => {
        for (const node of nodes) {
          const name = String(node._name || '').toLowerCase();
          if (name.includes('printer') || name.includes('pos') || name.includes('label') || name.includes('receipt')) {
            detected.push({
              name: node._name || 'USB Printer',
              vendorId: node.vendor_id ? `0x${node.vendor_id}` : null,
              productId: node.product_id ? `0x${node.product_id}` : null,
              pnpDeviceId: node._name,
              service: 'cups',
              isPrinterClass: true,
            });
          }
          if (node._items && Array.isArray(node._items)) {
            walkUsbTree(node._items);
          }
        }
      };

      walkUsbTree(items);
      return detected;
    } catch (err: any) {
      logger.error(`Error in scanMacUsbDevices: ${err.message}`);
      return [];
    }
  }

  startHotplugMonitoring(onChanged: (devices: DetectedUsbHardware[]) => void): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    logger.info('[UsbDiscoveryService] Live USB Hotplug Monitoring active.');

    let lastHash = '';

    this.monitorTimer = setInterval(async () => {
      if (this.isScanning) return;
      this.isScanning = true;
      try {
        const current = await this.scanPhysicalUsbDevices();
        const hash = current.map(d => d.pnpDeviceId).sort().join('|');

        if (hash !== lastHash) {
          lastHash = hash;
          logger.info(`[UsbDiscoveryService] USB PnP topology state change detected! Count: ${current.length}`);
          onChanged(current);
        }
      } catch (err: any) {
        logger.warn(`[UsbDiscoveryService] Hotplug scan notice: ${err.message}`);
      } finally {
        this.isScanning = false;
      }
    }, 5000);
  }

  stopHotplugMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.isMonitoring = false;
  }
}
