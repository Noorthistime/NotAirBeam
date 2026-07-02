import { Router } from 'express';
import { db, DbTransfer } from '../db';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function mapDbTransfer(row: DbTransfer) {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    senderName: row.sender_name,
    receiverName: row.receiver_name,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    userId: row.user_id,
  };
}

// GET /api/transfers — list transfers for authenticated user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const rows = db.prepare(
      `SELECT * FROM transfers WHERE user_id = ? ORDER BY started_at DESC LIMIT 100`
    ).all(req.user!.id) as DbTransfer[];

    return res.json({ transfers: rows.map(mapDbTransfer) });
  } catch (err) {
    console.error('[TRANSFERS] Get error:', err);
    return res.status(500).json({ error: 'Failed to load transfers' });
  }
});

// GET /api/transfers/:id — single transfer
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const row = db.prepare('SELECT * FROM transfers WHERE id = ?').get(req.params.id) as DbTransfer | undefined;
    if (!row) return res.status(404).json({ error: 'Transfer not found' });

    if (row.user_id !== req.user!.id && row.sender_id !== req.user!.id && row.receiver_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({ transfer: mapDbTransfer(row) });
  } catch (err) {
    console.error('[TRANSFERS] Get single error:', err);
    return res.status(500).json({ error: 'Failed to load transfer' });
  }
});

// POST /api/transfers — record a new transfer (called by server internally via WS completion)
router.post('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { senderId, receiverId, senderName, receiverName, fileName, fileSize, fileType } = req.body;
    const id = uuidv4();

    db.prepare(`
      INSERT INTO transfers (
        id, sender_id, receiver_id, sender_name, receiver_name,
        file_name, file_size, file_type, status, completed_at, user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?)
    `).run(
      id,
      senderId,
      receiverId,
      senderName,
      receiverName,
      fileName,
      fileSize,
      fileType || null,
      new Date().toISOString(),
      req.user?.id || null
    );

    return res.status(201).json({ transfer: { id } });
  } catch (err) {
    console.error('[TRANSFERS] Post error:', err);
    return res.status(500).json({ error: 'Failed to record transfer' });
  }
});

export default router;
