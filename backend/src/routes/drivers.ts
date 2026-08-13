import { Router } from 'express';
import prisma from '../config/db';

const router = Router();

// GET /api/drivers - Fetch driver software releases from database
router.get('/', async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        supportedDevice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    // Serialize BigInt fileSize for JSON
    const data = drivers.map(d => ({
      ...d,
      fileSize: d.fileSize.toString(),
    }));
    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch driver software catalog',
      message: error.message,
    });
  }
});

export default router;
