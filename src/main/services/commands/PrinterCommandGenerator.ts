import { V1PrinterProfileBrand } from '../../../shared/types';

export class JoshLabelCommands {
  static createTestLabel(quantity = 1): Buffer {
    const commands = 
      "SIZE 50 mm, 50 mm\r\n" +
      "GAP 3 mm, 0 mm\r\n" +
      "REFERENCE 0,0\r\n" +
      "SET TEAR ON\r\n" +
      "DIRECTION 1\r\n" +
      "CLS\r\n" +
      "TEXT 100,20,\"3\",0,1,1,\"SEZNIK JOSH\"\r\n" +
      "TEXT 70,55,\"2\",0,1,1,\"50mm x 50mm TEST LABEL\"\r\n" +
      "BARCODE 40,90,\"128\",100,1,0,2,2,\"12345678\"\r\n" +
      "TEXT 80,210,\"2\",0,1,1,\"REAL PRINT VERIFIED\"\r\n" +
      `PRINT ${quantity},1\r\n`;
    return Buffer.from(commands, 'ascii');
  }

  static createCustomLabel(text: string, barcode: string, quantity = 1): Buffer {
    const commands = 
      "SIZE 50 mm, 50 mm\r\n" +
      "GAP 3 mm, 0 mm\r\n" +
      "REFERENCE 0,0\r\n" +
      "SET TEAR ON\r\n" +
      "DIRECTION 1\r\n" +
      "CLS\r\n" +
      `TEXT 100,20,"3",0,1,1,"${text}"\r\n` +
      `BARCODE 40,80,"128",100,1,0,2,2,"${barcode}"\r\n` +
      `PRINT ${quantity},1\r\n`;
    return Buffer.from(commands, 'ascii');
  }
}

import { EscPosImageHelper } from './EscPosImageHelper';

export class VeerReceiptCommands {
  static createTestReceipt(): Buffer {
    const dateStr = new Date().toLocaleDateString();
    const initCmd = Buffer.from("\x1B\x40\x1B\x61\x01", 'latin1'); // Init + Center
    const logoImageCmd = EscPosImageHelper.generateSeznikLogoRaster(384, 64); // ESC/POS GS v 0 raster bit image

    const textPayload = 
      "\r\n\x1B\x61\x01" + // Center
      "SEZNIK POS STORE\r\n" +
      "GSTIN: 27AAAAA0000A1Z5\r\n" +
      "--------------------------------\r\n" +
      "VEER 58mm GRAPHICS & TEXT TEST\r\n" +
      "--------------------------------\r\n" +
      "\x1B\x61\x00" + // Left
      `Date: ${dateStr}\r\n` +
      "Graphics: ESC/POS GS v 0 VERIFIED\r\n" +
      "Status: PHYSICAL PRINT VERIFIED\r\n" +
      "--------------------------------\r\n" +
      "Item                 Qty     Amt\r\n" +
      "Thermal Paper Roll     2  Rs.150\r\n" +
      "POS Printer Adapter    1  Rs.450\r\n" +
      "--------------------------------\r\n" +
      "\x1B\x45\x01TOTAL                  Rs.600.00\x1B\x45\x00\r\n" +
      "--------------------------------\r\n" +
      "\x1B\x61\x01" + // Center
      "THANK YOU FOR USING SEZNIK!\r\n\r\n\r\n\r\n" +
      "\x1D\x56\x00"; // Cut

    const textBuf = Buffer.from(textPayload, 'latin1');
    return Buffer.concat([initCmd, logoImageCmd, textBuf]);
  }

  static createCustomReceipt(items: { name: string; qty: number; price: number }[]): Buffer {
    let itemLines = '';
    let total = 0;
    for (const item of items) {
      const amt = item.qty * item.price;
      total += amt;
      itemLines += `${item.name.padEnd(20, ' ')} ${String(item.qty).padStart(3, ' ')} ${String(amt).padStart(7, ' ')}\r\n`;
    }

    const payload = 
      "\x1B\x40" +
      "\x1B\x61\x01" +
      "SEZNIK POS STORE\r\n" +
      "--------------------------------\r\n" +
      "\x1B\x61\x00" +
      itemLines +
      "--------------------------------\r\n" +
      `\x1B\x45\x01TOTAL                  Rs.${total.toFixed(2)}\x1B\x45\x00\r\n` +
      "--------------------------------\r\n" +
      "\x1B\x61\x01" +
      "THANK YOU FOR YOUR BUSINESS!\r\n\r\n\r\n\r\n" +
      "\x1D\x56\x00";
    return Buffer.from(payload, 'latin1');
  }
}

export class DevReceiptCommands {
  static createTestReceipt(): Buffer {
    const dateStr = new Date().toLocaleDateString();
    const payload = 
      "\x1B\x40" +
      "\x1B\x61\x01" +
      "================================================\r\n" +
      "             SEZNIK DEV 80mm DUAL MODE          \r\n" +
      "================================================\r\n" +
      "\x1B\x61\x00" +
      `Date: ${dateStr}\r\n` +
      "Status: DUAL MODE 80mm RECEIPT VERIFIED\r\n" +
      "================================================\r\n\r\n\r\n\r\n" +
      "\x1D\x56\x00";
    return Buffer.from(payload, 'latin1');
  }
}

export class DevLabelCommands {
  static createTestLabel(quantity = 1): Buffer {
    const commands = 
      "SIZE 80 mm, 50 mm\r\n" +
      "GAP 3 mm, 0 mm\r\n" +
      "REFERENCE 0,0\r\n" +
      "SET TEAR ON\r\n" +
      "DIRECTION 1\r\n" +
      "CLS\r\n" +
      "TEXT 120,30,\"3\",0,1,1,\"SEZNIK DEV 80mm LABEL\"\r\n" +
      "BARCODE 60,100,\"128\",100,1,0,2,2,\"DEV80-99887766\"\r\n" +
      `PRINT ${quantity},1\r\n`;
    return Buffer.from(commands, 'ascii');
  }
}

export class PrinterCommandGenerator {
  static generateTestPayload(brand: V1PrinterProfileBrand, documentType?: string): Buffer {
    if (brand === 'JOSH') {
      return JoshLabelCommands.createTestLabel();
    } else if (brand === 'VEER') {
      return VeerReceiptCommands.createTestReceipt();
    } else if (brand === 'DEV') {
      if (documentType === 'LABEL') {
        return DevLabelCommands.createTestLabel();
      }
      return DevReceiptCommands.createTestReceipt();
    }
    return VeerReceiptCommands.createTestReceipt();
  }
}
