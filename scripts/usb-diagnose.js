const { execSync } = require('child_process');

console.log('====================================================');
console.log('       SEZNIK USB PRINTER HARDWARE DIAGNOSTIC       ');
console.log('====================================================\n');

try {
  console.log('[USB_SCAN] Querying physical Windows PnP Bus & USB Controllers...');
  
  const psPnpCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Select-Object Name, Caption, PNPDeviceID, PNPClass, Service, Status, ConfigManagerErrorCode | ConvertTo-Json"`;
  const pnpStdout = execSync(psPnpCommand, { maxBuffer: 15 * 1024 * 1024 }).toString();

  const pnpList = JSON.parse(pnpStdout || '[]');
  const list = Array.isArray(pnpList) ? pnpList : [pnpList];

  const usbDevices = [];

  for (const item of list) {
    const name = String(item.Name || item.Caption || '').trim();
    const pnpId = String(item.PNPDeviceID || '').toUpperCase();
    const pnpClass = String(item.PNPClass || '').toLowerCase();
    const service = String(item.Service || '').toLowerCase();
    const lowerName = name.toLowerCase();

    // Skip internal host controllers, hubs, webcams, audio, bluetooth, hid mouse/keyboard
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
      pnpId.startsWith('ROOT\\')
    ) {
      continue;
    }

    if (name === 'Root Print Queue') continue;

    const isPhysicalUsb = pnpId.startsWith('USB\\') || pnpId.startsWith('USBPRINT\\') || service === 'usbprint' || service === 'usbser';
    if (!isPhysicalUsb) continue;

    if (lowerName === 'usb composite device' && service !== 'usbprint' && service !== 'usbser') {
      continue;
    }

    const vidMatch = pnpId.match(/VID_([0-9A-F]{4})/i);
    const pidMatch = pnpId.match(/PID_([0-9A-F]{4})/i);

    usbDevices.push({
      name,
      vid: vidMatch ? `0x${vidMatch[1]}` : 'UNKNOWN',
      pid: pidMatch ? `0x${pidMatch[1]}` : 'UNKNOWN',
      pnpDeviceId: pnpId,
      pnpClass: item.PNPClass || 'Unknown',
      service: item.Service || 'None',
      status: item.Status || 'Unknown',
    });
  }

  console.log(`[USB_SCAN] Physical USB PnP Devices Found: ${usbDevices.length}\n`);

  usbDevices.forEach((dev, idx) => {
    console.log(`[DEVICE ${idx + 1}]`);
    console.log(`  Device Name:   ${dev.name}`);
    console.log(`  VID:           ${dev.vid}`);
    console.log(`  PID:           ${dev.pid}`);
    console.log(`  PNP Device ID: ${dev.pnpDeviceId}`);
    console.log(`  PNP Class:     ${dev.pnpClass}`);
    console.log(`  Service:       ${dev.service}`);
    console.log(`  Status:        ${dev.status}`);
    console.log('');
  });

  console.log('[SPOOLER_SCAN] Querying Windows Printer Spooler (Win32_Printer)...');
  const psPrinterCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name, DriverName, PortName, PrinterStatus, Default | ConvertTo-Json"`;
  const printerStdout = execSync(psPrinterCommand).toString();
  const printerList = JSON.parse(printerStdout || '[]');
  const printers = Array.isArray(printerList) ? printerList : [printerList];

  console.log(`[SPOOLER_SCAN] OS Printer Queues Found: ${printers.length}\n`);

  printers.forEach((prt, idx) => {
    console.log(`[PRINTER QUEUE ${idx + 1}]`);
    console.log(`  Queue Name:    ${prt.Name}`);
    console.log(`  Driver Name:   ${prt.DriverName}`);
    console.log(`  Port Name:     ${prt.PortName}`);
    console.log(`  Status Code:   ${prt.PrinterStatus}`);
    console.log(`  Is Default:    ${prt.Default ? 'YES' : 'NO'}`);
    console.log('');
  });

  console.log('----------------------------------------------------');
  if (usbDevices.length === 0 && printers.length === 0) {
    console.log('RESULT: NO USB PRINTER HARDWARE OR SPOOLER QUEUE DETECTED.');
    console.log('Status: DISCONNECTED');
  } else {
    console.log(`RESULT: ${usbDevices.length} USB device(s) & ${printers.length} spooler queue(s) detected.`);
  }
  console.log('====================================================\n');

} catch (err) {
  console.error('[USB_DIAGNOSE ERROR]', err.message);
}
