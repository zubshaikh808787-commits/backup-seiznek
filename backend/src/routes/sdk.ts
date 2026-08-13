import { Router } from 'express';
import prisma from '../config/db';

const router = Router();

// GET /api/sdk - Fetch SDK releases from database
router.get('/', async (req, res) => {
  try {
    const sdks = await prisma.sDKVersion.findMany({
      include: {
        supportedDevice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    // Serialize BigInt fileSize for JSON
    const data = sdks.map(s => ({
      ...s,
      fileSize: s.fileSize.toString(),
    }));
    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SDK releases catalog',
      message: error.message,
    });
  }
});

export default router;
