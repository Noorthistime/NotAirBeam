import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { db, DbUser } from '../db';

export interface AuthRequest extends Request {
  user?: { id: string; username: string; email: string; displayName: string | null };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };

    const session = db.prepare(
      `SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`
    ).get(token);

    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as DbUser | undefined;
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) { next(); return; }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as DbUser | undefined;
    if (user) {
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
      };
    }
    next();
  } catch {
    next();
  }
}
