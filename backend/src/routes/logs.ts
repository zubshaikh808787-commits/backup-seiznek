import { Router } from 'express';
import prisma from '../config/db';

const router = Router();

// GET /api/logs - Fetch audit logs from database
router.get('/', async (req, res) => {
  try {
    const logs = await prisma.installationLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { printer: true, user: true },
    });
    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs from database',
      message: error.message,
    });
  }
});

// POST /api/logs - Save telemetry/installation log to database
router.post('/', async (req, res) => {
  try {
    const { actionType, status, details, errorCode, errorMessage, printerId, userId } = req.body;
    const newLog = await prisma.installationLog.create({
      data: {
        actionType: actionType || 'SYSTEM_EVENT',
        status: status || 'PENDING',
        details: details || '',
        errorCode,
        errorMessage,
        printerId,
        userId,
      },
    });
    res.status(201).json({
      success: true,
      message: 'Log record saved to database successfully',
      data: newLog,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to persist installation log',
      message: error.message,
    });
  }
});

export default router;
