// VEER 58mm Thermal Receipt Command Generator (ESC/POS Compliant)
// SDK-compatible binary buffer generator for VEER BLE/USB transports

export class VeerReceiptCommandGenerator {
  /**
   * Generates exact required SDK-compatible VEER BLE Test Receipt:
   * ================================
   *           TEST RECEIPT
   * ================================
   * 
   * Printer: VEER
   * Connection: BLE
   * 
   * BLE PRINT TEST
   * 
   * ================================
   */
  static createTestReceipt(): Buffer {
    const timestamp = new Date().toLocaleString();
    const payload = 
      "\x1B\x40" + // Initialize printer
      "\x1B\x61\x01" + // Center alignment
      "================================\r\n" +
      "\x1B\x45\x01          TEST RECEIPT          \x1B\x45\x00\r\n" +
      "================================\r\n\r\n" +
      "\x1B\x61\x00" + // Left alignment
      "Printer: VEER\r\n" +
      "Connection: BLE (GATT)\r\n" +
      `Time: ${timestamp}\r\n\r\n` +
      "\x1B\x61\x01" + // Center alignment
      "\x1B\x45\x01BLE PRINT TEST VERIFIED ✓\x1B\x45\x00\r\n\r\n" +
      "================================\r\n\r\n\r\n\r\n" +
      "\x1B\x64\x03" + // Feed 3 lines
      "\x1D\x56\x00"; // Cut (if supported)

    return Buffer.from(payload, 'latin1');
  }

  /**
   * Generates custom receipt binary payload
   */
  static createCustomReceipt(
    storeName = "SEZNIK POS STORE",
    items: { name: string; qty: number; price: number }[] = [],
    total?: number
  ): Buffer {
    let itemLines = '';
    let calcTotal = 0;

    for (const item of items) {
      const amt = item.qty * item.price;
      calcTotal += amt;
      const line = `${item.name.substring(0, 16).padEnd(16, ' ')} ${String(item.qty).padStart(3, ' ')} ${String(amt.toFixed(2)).padStart(8, ' ')}\r\n`;
      itemLines += line;
    }

    const finalTotal = total !== undefined ? total : calcTotal;

    const payload = 
      "\x1B\x40" + // Init
      "\x1B\x61\x01" + // Center
      `\x1B\x45\x01${storeName}\x1B\x45\x00\r\n` +
      "--------------------------------\r\n" +
      "\x1B\x61\x00" + // Left
      `Date: ${new Date().toLocaleDateString()}\r\n` +
      `Trans: BLE-GATT-${Date.now().toString().slice(-6)}\r\n` +
      "--------------------------------\r\n" +
      (itemLines || "VEER 58mm Thermal Print       1   Rs.100.00\r\n") +
      "--------------------------------\r\n" +
      `\x1B\x45\x01TOTAL                   Rs.${finalTotal.toFixed(2)}\x1B\x45\x00\r\n` +
      "--------------------------------\r\n" +
      "\x1B\x61\x01" + // Center
      "THANK YOU FOR USING SEZNIK!\r\n\r\n\r\n\r\n" +
      "\x1B\x64\x03" +
      "\x1D\x56\x00";

    return Buffer.from(payload, 'latin1');
  }
}
