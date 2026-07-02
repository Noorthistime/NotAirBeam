import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, DbUser } from '../db';
import { config } from '../config/env';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate, registerSchema, loginSchema, changePasswordSchema } from '../middleware/validate';

const router = Router();

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined;
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const existingUsername = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser | undefined;
    if (existingUsername) return res.status(409).json({ error: 'Username taken' });

    const hashed = await bcrypt.hash(password, 12);
    const id = uuidv4();

    db.prepare(`
      INSERT INTO users (id, username, email, password, display_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, email, hashed, displayName || username);

    const token = jwt.sign({ userId: id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, device_id, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      id,
      token,
      (req.headers['x-device-id'] as string) || 'unknown',
      expiresAt
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      user: { id, username, email, displayName: displayName || username },
      token,
    });
  } catch (err) {
    console.error('[AUTH] Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (id, user_id, token, device_id, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      user.id,
      token,
      (req.headers['x-device-id'] as string) || 'unknown',
      expiresAt
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: { id: user.id, username: user.username, email: user.email, displayName: user.display_name },
      token,
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    res.clearCookie('token');
    return res.json({ message: 'Logged out' });
  } catch {
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

// PUT /api/auth/password
router.put('/password', authMiddleware, validate(changePasswordSchema), async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as DbUser | undefined;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').run(
      hashed,
      new Date().toISOString(),
      req.user!.id
    );

    return res.json({ message: 'Password updated' });
  } catch {
    return res.status(500).json({ error: 'Password update failed' });
  }
});

export default router;
