import { Router } from 'express';
import gamesRouter from './games.js';
import scriptsRouter from './scripts.js';

const router = Router();

router.use('/games', gamesRouter);
router.use('/scripts', scriptsRouter);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
