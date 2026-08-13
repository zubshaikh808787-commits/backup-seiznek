import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with initial SEZNIK hardware catalog (JOSH, VEER, DEV)...');

  // 1. JOSH Supported Device (DeTong DP27 Series 50x50mm Thermal Label Printer)
  const joshDevice = await prisma.supportedDevice.upsert({
    where: { modelName: 'JOSH-DP27-LABEL' },
    update: {},
    create: {
      modelName: 'JOSH-DP27-LABEL',
      vendorId: '0x4B43',
      productId: '0x2D37',
      printerType: 'LABEL',
      paperWidthMm: 50,
      commandLanguage: 'TSPL',
      supportsDualMode: false,
    },
  });

  // 2. VEER Supported Device (POS58 58mm Thermal Receipt Printer)
  const veerDevice = await prisma.supportedDevice.upsert({
    where: { modelName: 'VEER-POS58-RECEIPT' },
    update: {},
    create: {
      modelName: 'VEER-POS58-RECEIPT',
      vendorId: '0x3533',
      productId: '0x5A11',
      printerType: 'RECEIPT',
      paperWidthMm: 58,
      commandLanguage: 'ESC/POS',
      supportsDualMode: false,
    },
  });

  // 3. DEV Supported Device (SZ-80D 80mm Dual Mode Printer)
  const devDevice = await prisma.supportedDevice.upsert({
    where: { modelName: 'DEV-SZ80D-DUAL' },
    update: {},
    create: {
      modelName: 'DEV-SZ80D-DUAL',
      vendorId: '0x0FE6',
      productId: '0x811E',
      printerType: 'RECEIPT_AND_LABEL',
      paperWidthMm: 80,
      commandLanguage: 'ESC/POS + TSPL',
      supportsDualMode: true,
    },
  });

  // 4. Initial Printers Catalog
  const existingJoshPrinter = await prisma.printer.findFirst({
    where: { modelNumber: 'JOSH-DP27-LABEL' },
  });

  if (!existingJoshPrinter) {
    await prisma.printer.create({
      data: {
        name: 'Detong electronic DP27 series label printer driver',
        modelNumber: 'JOSH-DP27-LABEL',
        serialNumber: 'JOSH-DP27-2026-001',
        connectionType: 'USB',
        vendorId: '0x4B43',
        productId: '0x2D37',
        portName: 'CP001',
        printerType: 'LABEL',
        paperWidthMm: 50,
        printerLanguage: 'TSPL',
        isDualMode: false,
        installedDriverVersion: 'v2.1.2022',
        installedFirmwareVersion: 'v1.0.0',
        installedSdkVersion: 'v2.1.0',
        status: 'READY',
        healthStatus: 'HEALTHY',
      },
    });
  }

  const existingVeerPrinter = await prisma.printer.findFirst({
    where: { modelNumber: 'VEER-POS58-RECEIPT' },
  });

  if (!existingVeerPrinter) {
    await prisma.printer.create({
      data: {
        name: 'POS58 Thermal Receipt Printer',
        modelNumber: 'VEER-POS58-RECEIPT',
        serialNumber: 'VEER-POS58-2026-002',
        connectionType: 'USB',
        vendorId: '0x3533',
        productId: '0x5A11',
        portName: 'USB001',
        printerType: 'RECEIPT',
        paperWidthMm: 58,
        printerLanguage: 'ESC/POS',
        isDualMode: false,
        installedDriverVersion: 'v2021.09.16',
        installedFirmwareVersion: 'v1.0.0',
        installedSdkVersion: 'v1.0.0',
        status: 'READY',
        healthStatus: 'HEALTHY',
      },
    });
  }

  // 5. Driver Releases
  const joshDriver = await prisma.driver.findFirst({
    where: { version: 'v2.1.2022', supportedDeviceId: joshDevice.id },
  });

  if (!joshDriver) {
    await prisma.driver.create({
      data: {
        version: 'v2.1.2022',
        supportedOs: 'WINDOWS',
        architecture: 'x64',
        packageType: 'EXE',
        downloadUrl: 'file:///C:/Users/omen/OneDrive/Desktop/josh-files/Win%20Driver%20Driver%20JOSH%20Label%20Printer.exe',
        checksumSha256: 'local_josh_dp27_label_driver_sha256',
        fileSize: BigInt(1183184),
        isDualReceiptLabel: false,
        supportedDeviceId: joshDevice.id,
      },
    });
  }

  const veerDriver = await prisma.driver.findFirst({
    where: { version: 'v2021.09.16', supportedDeviceId: veerDevice.id },
  });

  if (!veerDriver) {
    await prisma.driver.create({
      data: {
        version: 'v2021.09.16',
        supportedOs: 'WINDOWS',
        architecture: 'x64',
        packageType: 'EXE',
        downloadUrl: 'file:///C:/Users/omen/Downloads/VEER%20Thermal%20printer%20files/POS58Setup_20210916.exe',
        checksumSha256: 'local_veer_pos58_receipt_driver_sha256',
        fileSize: BigInt(2540000),
        isDualReceiptLabel: false,
        supportedDeviceId: veerDevice.id,
      },
    });
  }

  // 6. JOSH Test Label Record in PostgreSQL
  const b64Path = path.resolve(process.cwd(), 'src/renderer/src/assets/josh_uploaded_label_b64.txt');
  let joshB64 = '';
  if (fs.existsSync(b64Path)) {
    joshB64 = fs.readFileSync(b64Path, 'utf-8').trim();
  }

  if (joshB64) {
    try {
      await (prisma as any).testLabel.upsert({
        where: { printerBrand: 'JOSH' },
        update: {
          imageDataBase64: joshB64,
          widthMm: 40,
          heightMm: 40,
          barcodeValue: '12345678',
        },
        create: {
          printerBrand: 'JOSH',
          labelType: 'TEST',
          imageDataBase64: joshB64,
          widthMm: 40,
          heightMm: 40,
          barcodeValue: '12345678',
        },
      });
    } catch (e) {}

    await prisma.setting.upsert({
      where: { key: 'JOSH_TEST_LABEL_B64' },
      update: { value: joshB64, description: 'Stored JOSH 40x40mm Barcode Test Label (12345678)' },
      create: { key: 'JOSH_TEST_LABEL_B64', value: joshB64, description: 'Stored JOSH 40x40mm Barcode Test Label (12345678)' },
    });
  }

  // 7. System Log
  await prisma.installationLog.create({
    data: {
      actionType: 'SYSTEM_INITIALIZATION',
      status: 'SUCCESS',
      details: 'Seznik Hardware Catalog initialized for JOSH (DP27 Label), VEER (POS58 Receipt), and DEV (SZ-80D Dual Mode).',
    },
  });

  console.log('Database seeding for JOSH, VEER, and DEV completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
