import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { queryOne, queryAll } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', authenticate, async (req, res) => {
  const rows = await queryAll(
    "SELECT amount, platform_fee FROM orders WHERE seller_id=$1 AND status IN ('paid','shipped','delivered')",
    [req.user.id]
  );
  const totalRevenue = rows.reduce((s, o) => s + (o.amount || 0), 0);
  const totalFees    = rows.reduce((s, o) => s + (o.platform_fee || 0), 0);
  res.json({ totalRevenue, totalFees, netRevenue: totalRevenue - totalFees, orderCount: rows.length });
});

router.post('/buy-now/:listingId', authenticate, async (req, res) => {
  const listing = await queryOne('SELECT * FROM listings WHERE id=$1', [req.params.listingId]);
  if (!listing?.buynow_price) return res.status(404).json({ error: 'Listing not found' });

  const fee     = listing.buynow_price * 0.05;
  const orderId = uuid();
  const order   = await queryOne(
    `INSERT INTO orders (id, buyer_id, seller_id, listing_id, type, amount, platform_fee, total, status, shipping_addr)
     VALUES ($1,$2,$3,$4,'buy_now',$5,$6,$7,'paid',$8) RETURNING *`,
    [orderId, req.user.id, listing.seller_id, listing.id,
     listing.buynow_price, fee, listing.buynow_price,
     JSON.stringify(req.body.shippingAddress || {})]
  );
  await queryOne('UPDATE listings SET buynow_sold=buynow_sold+1 WHERE id=$1 RETURNING buynow_sold, buynow_qty', [listing.id]);
  res.json({ order });
});

export default router;
