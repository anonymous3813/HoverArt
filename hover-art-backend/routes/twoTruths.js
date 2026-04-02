import { Router } from 'express';
import { analyzeTwoTruthsLie } from '../services/openaiTwoTruthsService.js';

const router = Router();

router.post('/two-truths-analyze', async (req, res) => {
  const { phrases } = req.body ?? {};

  if (!Array.isArray(phrases) || phrases.length !== 3) {
    res.status(400).json({ error: 'Body must include phrases: array of exactly 3 items.' });
    return;
  }

  for (let i = 0; i < 3; i++) {
    const p = phrases[i];
    if (typeof p?.transcript !== 'string') {
      res.status(400).json({ error: `phrases[${i}].transcript must be a string.` });
      return;
    }
  }

  try {
    const result = await analyzeTwoTruthsLie({ phrases });
    res.json({ ok: true, result });
  } catch (err) {
    console.error('two-truths-analyze:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
