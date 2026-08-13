import { Router } from 'express';
import prisma from '../config/db';

const router = Router();

// GET /api/printers - Fetch all printers from database
router.get('/', async (req, res) => {
  try {
    const printers = await prisma.printer.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: printers,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch printers from database',
      message: error.message,
    });
  }
});

// GET /api/printers/:id - Fetch single printer by ID
router.get('/:id', async (req, res) => {
  try {
    const printer = await prisma.printer.findUnique({
      where: { id: req.params.id },
    });
    if (!printer) {
      res.status(404).json({ success: false, error: 'Printer not found' });
      return;
    }
    res.json({
      success: true,
      data: printer,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch printer details',
      message: error.message,
    });
  }
});

// POST /api/printers - Register a new detected printer
router.post('/', async (req, res) => {
  try {
    const { name, modelNumber, serialNumber, connectionType, vendorId, productId, macAddress, ipAddress, portName, printerType, paperWidthMm, printerLanguage, isDualMode } = req.body;
    const newPrinter = await prisma.printer.create({
      data: {
        name,
        modelNumber,
        serialNumber,
        connectionType,
        vendorId,
        productId,
        macAddress,
        ipAddress,
        portName,
        printerType,
        paperWidthMm: paperWidthMm ? parseInt(paperWidthMm) : 80,
        printerLanguage,
        isDualMode: Boolean(isDualMode),
        status: 'CONNECTED',
      },
    });
    res.status(201).json({
      success: true,
      data: newPrinter,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to create printer record',
      message: error.message,
    });
  }
});

// PUT /api/printers/:id - Update printer status or details
router.put('/:id', async (req, res) => {
  try {
    const updatedPrinter = await prisma.printer.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({
      success: true,
      data: updatedPrinter,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update printer',
      message: error.message,
    });
  }
});

// POST /api/printers/setup-complete - Handle printer setup completion and return stored test label from PostgreSQL
router.post('/setup-complete', async (req, res) => {
  try {
    const { printerType, setupCompleted } = req.body;

    if (!setupCompleted) {
      res.status(400).json({
        success: false,
        error: 'Setup not completed',
        message: 'Printer setup automation was not reported as completed.',
      });
      return;
    }

    const brand = String(printerType || 'JOSH').toUpperCase();

    // Query PostgreSQL for stored test label
    let labelRecord = null;
    try {
      labelRecord = await (prisma as any).testLabel.findUnique({
        where: { printerBrand: brand },
      });
    } catch (e) {}

    let rawB64 = labelRecord?.imageDataBase64;

    // Fallback query to Setting table in PostgreSQL if TestLabel record is pending
    if (!rawB64) {
      const settingRecord = await prisma.setting.findUnique({
        where: { key: `${brand}_TEST_LABEL_B64` },
      });
      rawB64 = settingRecord?.value;
    }

    if (!rawB64) {
      console.warn(`[JOSH Backend] Test label configuration for brand "${brand}" not found in PostgreSQL.`);
      res.status(404).json({
        success: false,
        printerType: brand,
        error: 'JOSH test label configuration not found.',
        message: `JOSH test label configuration not found in PostgreSQL database for printer brand "${brand}".`,
      });
      return;
    }

    const formattedImageData = rawB64.startsWith('data:') ? rawB64 : `data:image/png;base64,${rawB64}`;

    console.log(`[JOSH Backend] JOSH Setup completion verified. Retrieved stored 40x40mm test label for "${brand}" from PostgreSQL ✓`);

    res.json({
      success: true,
      printerType: brand,
      setupCompleted: true,
      testPrint: true,
      widthMm: labelRecord?.widthMm || 40,
      heightMm: labelRecord?.heightMm || 40,
      barcodeValue: labelRecord?.barcodeValue || '12345678',
      imageData: formattedImageData,
      message: `JOSH setup completion verified. Stored 40x40mm test label retrieved from PostgreSQL database.`,
    });
  } catch (error: any) {
    console.error(`[JOSH Backend ERROR] Error fetching setup completion test label: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve test label from database',
      message: error.message,
    });
  }
});

// GET /api/printers/test-label/:brand - Query PostgreSQL specifically for printer test label
router.get('/test-label/:brand', async (req, res) => {
  try {
    const brand = String(req.params.brand || 'JOSH').toUpperCase();

    let labelRecord = null;
    try {
      labelRecord = await (prisma as any).testLabel.findUnique({
        where: { printerBrand: brand },
      });
    } catch (e) {}

    let rawB64 = labelRecord?.imageDataBase64;

    if (!rawB64) {
      const settingRecord = await prisma.setting.findUnique({
        where: { key: `${brand}_TEST_LABEL_B64` },
      });
      rawB64 = settingRecord?.value;
    }

    if (!rawB64) {
      res.status(404).json({
        success: false,
        error: 'JOSH test label configuration not found.',
        message: `No test label image found in PostgreSQL for brand "${brand}".`,
      });
      return;
    }

    const formattedImageData = rawB64.startsWith('data:') ? rawB64 : `data:image/png;base64,${rawB64}`;

    res.json({
      success: true,
      printerBrand: brand,
      labelType: 'TEST',
      widthMm: labelRecord?.widthMm || 40,
      heightMm: labelRecord?.heightMm || 40,
      barcodeValue: labelRecord?.barcodeValue || '12345678',
      imageData: formattedImageData,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch test label from database',
      message: error.message,
    });
  }
});

// DELETE /api/printers/:id - Remove printer from database
router.delete('/:id', async (req, res) => {
  try {
    await prisma.printer.delete({
      where: { id: req.params.id },
    });
    res.json({
      success: true,
      message: 'Printer removed successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete printer',
      message: error.message,
    });
  }
});

export default router;
