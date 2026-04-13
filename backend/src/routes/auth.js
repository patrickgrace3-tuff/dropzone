import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { queryOne, queryAll } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router  = Router();
const SECRET  = process.env.JWT_SECRET || 'changeme_secret_please_update';
const mkToken = (id) => jwt.sign({ userId: id }, SECRET, { expiresIn: '30d' });

function pub(u) {
  if (!u) return null;
  return {
    id:           u.id,
    username:     u.username,
    email:        u.email,
    displayName:  u.display_name,
    avatar:       u.avatar,
    bio:          u.bio,
    role:         u.role,
    isBanned:     u.is_banned,
    createdAt:    u.created_at,
    sellerProfile: {
      rating:       u.seller_rating,
      reviewCount:  u.seller_reviews,
      totalSales:   u.seller_sales,
      totalRevenue: u.seller_revenue,
      verified:     u.seller_verified || false,
    },
  };
}

router.post('/register', async (req, res) => {
  const { username, email, password, displayName } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email and password are required' });

  const exists = await queryOne(
    'SELECT id FROM users WHERE email=$1 OR username=$2',
    [email.toLowerCase(), username]
  );
  if (exists) return res.status(409).json({ error: 'Email or username already taken' });

  const hash = await bcrypt.hash(password, 12);
  const id   = uuid();
  const user = await queryOne(
    `INSERT INTO users (id, username, email, password_hash, display_name)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, username, email.toLowerCase(), hash, displayName || username]
  );
  res.status(201).json({ token: mkToken(id), user: pub(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await queryOne('SELECT * FROM users WHERE email=$1', [email?.toLowerCase()]);
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  if (user.is_banned) return res.status(403).json({ error: 'Account banned' });
  res.json({ token: mkToken(user.id), user: pub(user) });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: pub(req.user) });
});

router.post('/become-seller', authenticate, async (req, res) => {
  const user = await queryOne(
    "UPDATE users SET role='seller', updated_at=NOW() WHERE id=$1 RETURNING *",
    [req.user.id]
  );
  res.json({ user: pub(user) });
});

export { pub as userToPublic };
export default router;
