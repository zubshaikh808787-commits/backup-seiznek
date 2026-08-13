import { Router } from 'express';
import prisma from '../config/db';

const router = Router();

// GET /api/firmware - Fetch firmware release versions from database
router.get('/', async (req, res) => {
  try {
    const firmwares = await prisma.firmwareVersion.findMany({
      include: {
        supportedDevice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    // Serialize BigInt fileSize for JSON
    const data = firmwares.map(f => ({
      ...f,
      fileSize: f.fileSize.toString(),
    }));
    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch firmware updates catalog',
      message: error.message,
    });
  }
});

export default router;
