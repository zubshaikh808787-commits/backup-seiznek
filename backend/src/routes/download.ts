import { Router } from 'express';

const router = Router();

// GET /api/download/:fileId
router.get('/:fileId', (req, res) => {
  res.json({
    success: true,
    message: `File download URL requested for ${req.params.fileId}`,
    downloadUrl: `https://downloads.seznik.com/assets/${req.params.fileId}.zip`,
  });
});

export default router;
