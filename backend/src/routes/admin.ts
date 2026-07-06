import { Router } from 'express';
import { db } from '../db';
import { getAllPeers } from '../ws/rooms';

const router = Router();

// Validate Admin auth token (simple secret header check)
router.use((req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  const expectedSecret = process.env.ADMIN_SECRET || 'nothing_drop_secure';
  if (secret !== expectedSecret) {
    return res.status(403).json({ error: 'Access denied: invalid secret key' });
  }
  next();
});

router.get('/stats', (req, res) => {
  try {
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number })?.count || 0;
    const totalTransfers = (db.prepare('SELECT COUNT(*) as count FROM transfers').get() as { count: number })?.count || 0;
    
    // Get all online peers
    const activePeers = getAllPeers().map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      os: p.os,
      ip: p.ip,
      joinedAt: p.joinedAt,
      roomCode: p.roomCode || null,
    }));

    // Uptime
    const uptime = process.uptime();

    res.json({
      status: 'ok',
      totalUsers,
      totalTransfers,
      activePeerCount: activePeers.length,
      activePeers,
      uptime,
    });
  } catch (err) {
    console.error('[ADMIN] Stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve admin stats' });
  }
});

export default router;
