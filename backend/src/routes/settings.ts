import { Router } from 'express';
import prisma from '../config/db';

const router = Router();

// GET /api/settings - Fetch all settings key-value pairs
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system settings',
      message: error.message,
    });
  }
});

// POST /api/settings - Save or update setting key-value pair
router.post('/', async (req, res) => {
  try {
    const { key, value, description } = req.body;
    if (!key) {
      res.status(400).json({ success: false, error: 'Key is required' });
      return;
    }
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value), description },
      create: { key, value: String(value), description },
    });
    res.json({
      success: true,
      data: setting,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to save setting',
      message: error.message,
    });
  }
});

export default router;
