import jwt from 'jsonwebtoken';
import { queryOne } from '../config/db.js';

const SECRET = process.env.JWT_SECRET || 'changeme_secret_please_update';

export const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(header.split(' ')[1], SECRET);
    const user    = await queryOne('SELECT * FROM users WHERE id=$1', [payload.userId]);
    if (!user || user.is_banned) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireSeller = (req, res, next) => {
  if (req.user.role !== 'seller' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Seller account required' });
  next();
};
