import { Router } from 'express';
import { queryOne, queryAll } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { userToPublic } from './auth.js';

const router = Router();

router.get('/me/orders', authenticate, async (req, res) => {
  const orders = await queryAll(
    `SELECT o.*, l.title as lt, l.images as li,
            s.username as su, s.display_name as sd
     FROM orders o
     JOIN listings l ON o.listing_id=l.id
     JOIN users s ON o.seller_id=s.id
     WHERE o.buyer_id=$1 ORDER BY o.created_at DESC`,
    [req.user.id]
  );
  res.json({ orders: orders.map(o => ({ ...o, listing: { title: o.lt, images: o.li }, seller: { username: o.su, displayName: o.sd } })) });
});

router.get('/me/sales', authenticate, async (req, res) => {
  const orders = await queryAll(
    `SELECT o.*, l.title as lt, l.images as li,
            b.username as bu, b.display_name as bd
     FROM orders o
     JOIN listings l ON o.listing_id=l.id
     JOIN users b ON o.buyer_id=b.id
     WHERE o.seller_id=$1 ORDER BY o.created_at DESC`,
    [req.user.id]
  );
  res.json({ orders: orders.map(o => ({ ...o, listing: { title: o.lt, images: o.li }, buyer: { username: o.bu, displayName: o.bd } })) });
});

router.put('/me/profile', authenticate, async (req, res) => {
  const { displayName, bio, avatar } = req.body;
  const user = await queryOne(
    `UPDATE users SET
       display_name = COALESCE($1, display_name),
       bio          = COALESCE($2, bio),
       avatar       = COALESCE($3, avatar),
       updated_at   = NOW()
     WHERE id=$4 RETURNING *`,
    [displayName || null, bio ?? null, avatar || null, req.user.id]
  );
  res.json({ user: userToPublic(user) });
});

router.get('/:username', async (req, res) => {
  const user = await queryOne('SELECT * FROM users WHERE username=$1', [req.params.username]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: userToPublic(user) });
});

export default router;
