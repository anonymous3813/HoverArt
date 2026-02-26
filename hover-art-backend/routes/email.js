import { Router } from 'express';
import { sendCanvasEmail } from '../services/emailService.js';

const router = Router();

router.post('/share-email', async (req, res) => {
  const { to, imageData, message } = req.body;

  if (!to || !imageData) {
    res.status(400).json({ error: 'Missing required fields: to, imageData' });
    return;
  }

  try {
    await sendCanvasEmail({ to, imageData, message });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
