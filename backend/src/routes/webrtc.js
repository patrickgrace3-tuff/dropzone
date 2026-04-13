import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Store active stream sessions in memory
const activeSessions = new Map();

// POST /api/webrtc/session - seller starts a broadcast session
router.post('/session', authenticate, (req, res) => {
  const { showId } = req.body;
  if (!showId) return res.status(400).json({ error: 'showId required' });
  activeSessions.set(showId, {
    sellerId:    req.user.id,
    showId,
    viewers:     new Set(),
    createdAt:   new Date().toISOString(),
  });
  res.json({ ok: true, showId });
});

// DELETE /api/webrtc/session/:showId - seller ends broadcast
router.delete('/session/:showId', authenticate, (req, res) => {
  activeSessions.delete(req.params.showId);
  res.json({ ok: true });
});

// GET /api/webrtc/session/:showId - check if session exists
router.get('/session/:showId', (req, res) => {
  const session = activeSessions.get(req.params.showId);
  res.json({ active: !!session });
});

export default router;
