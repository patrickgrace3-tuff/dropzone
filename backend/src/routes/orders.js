import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { queryOne, queryAll, query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Add orders table columns if needed (safe to re-run)
async function ensureOrderCols() {
  const cols = [
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_intent TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_note TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_note TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_rating INTEGER`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_comment TEXT`,
  ];
  for (const col of cols) { try { await query(col); } catch {} }
}
ensureOrderCols();

function fmtOrder(o) {
  return {
    ...o,
    shippingAddr: o.shipping_addr || {},
    listing: o.listing_id ? {
      id:     o.listing_id,
      title:  o.l_title,
      images: o.l_images || [],
      category: o.l_category,
    } : null,
    buyer:  { id: o.buyer_id,  username: o.b_username,  displayName: o.b_display },
    seller: { id: o.seller_id, username: o.s_username,  displayName: o.s_display },
  };
}

const BASE_SELECT = `
  SELECT o.*,
    l.title as l_title, l.images as l_images, l.category as l_category,
    b.username as b_username, b.display_name as b_display,
    s.username as s_username, s.display_name as s_display
  FROM orders o
  LEFT JOIN listings l ON o.listing_id = l.id
  LEFT JOIN users b ON o.buyer_id = b.id
  LEFT JOIN users s ON o.seller_id = s.id
`;

// GET /api/orders/my — buyer's purchases
router.get('/my', authenticate, async (req, res) => {
  const rows = await queryAll(`${BASE_SELECT} WHERE o.buyer_id=$1 ORDER BY o.created_at DESC`, [req.user.id]);
  res.json({ orders: rows.map(fmtOrder) });
});

// GET /api/orders/sales — seller's sales
router.get('/sales', authenticate, async (req, res) => {
  const rows = await queryAll(`${BASE_SELECT} WHERE o.seller_id=$1 ORDER BY o.created_at DESC`, [req.user.id]);
  res.json({ orders: rows.map(fmtOrder) });
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res) => {
  const row = await queryOne(`${BASE_SELECT} WHERE o.id=$1`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Order not found' });
  if (row.buyer_id !== req.user.id && row.seller_id !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' });
  res.json({ order: fmtOrder(row) });
});

// POST /api/orders — create order after auction win or buy now
router.post('/', authenticate, async (req, res) => {
  const { listingId, type, shippingAddress, paymentMethod } = req.body;
  const listing = await queryOne('SELECT * FROM listings WHERE id=$1', [listingId]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const amount     = type === 'buy_now' ? listing.buynow_price : listing.auction_current;
  const platformFee= amount * 0.05;
  const id         = uuid();

  const order = await queryOne(
    `INSERT INTO orders (id, buyer_id, seller_id, listing_id, type, amount, platform_fee, total, status, shipping_addr)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending_payment',$9) RETURNING *`,
    [id, req.user.id, listing.seller_id, listing.id, type, amount, platformFee, amount, JSON.stringify(shippingAddress || {})]
  );

  // Mark listing as sold
  await query("UPDATE listings SET status='sold' WHERE id=$1", [listingId]);

  res.status(201).json({ order: fmtOrder({ ...order, l_title: listing.title, l_images: listing.images }) });
});

// PUT /api/orders/:id/shipping — buyer submits shipping address
router.put('/:id/shipping', authenticate, async (req, res) => {
  const { shippingAddress } = req.body;
  const order = await queryOne('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const updated = await queryOne(
    `UPDATE orders SET shipping_addr=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [JSON.stringify(shippingAddress), req.params.id]
  );
  res.json({ order: fmtOrder(updated) });
});

// PUT /api/orders/:id/pay — mark as paid (simplified, no real Stripe yet)
router.put('/:id/pay', authenticate, async (req, res) => {
  const { paymentMethod } = req.body;
  const order = await queryOne('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const updated = await queryOne(
    `UPDATE orders SET status='paid', updated_at=NOW() WHERE id=$2 RETURNING *`,
    [paymentMethod || 'card', req.params.id]
  );
  res.json({ order: fmtOrder(updated) });
});

// PUT /api/orders/:id/ship — seller marks as shipped
router.put('/:id/ship', authenticate, async (req, res) => {
  const { trackingNumber, carrier } = req.body;
  const order = await queryOne('SELECT * FROM orders WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const updated = await queryOne(
    `UPDATE orders SET status='shipped', tracking_number=$1, carrier=$2, shipped_at=NOW(), updated_at=NOW() WHERE id=$3 RETURNING *`,
    [trackingNumber || '', carrier || '', req.params.id]
  );
  res.json({ order: fmtOrder(updated) });
});

// PUT /api/orders/:id/deliver — mark delivered
router.put('/:id/deliver', authenticate, async (req, res) => {
  const order = await queryOne('SELECT * FROM orders WHERE id=$1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const updated = await queryOne(
    `UPDATE orders SET status='delivered', delivered_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  res.json({ order: fmtOrder(updated) });
});

// POST /api/orders/:id/review
router.post('/:id/review', authenticate, async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });
  const order = await queryOne('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  await query(
    `UPDATE orders SET review_rating=$1, review_comment=$2, updated_at=NOW() WHERE id=$3`,
    [rating, comment || '', req.params.id]
  );
  await query(
    `UPDATE users SET
       seller_rating = (SELECT AVG(review_rating) FROM orders WHERE seller_id=$1 AND review_rating IS NOT NULL),
       seller_reviews = (SELECT COUNT(*) FROM orders WHERE seller_id=$1 AND review_rating IS NOT NULL)
     WHERE id=$1`,
    [order.seller_id]
  );
  res.json({ ok: true });
});

export default router;
