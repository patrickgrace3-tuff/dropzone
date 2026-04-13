import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { queryOne, queryAll, query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Ensure extra columns exist (safe to re-run)
async function ensureCols() {
  const cols = [
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_rating INTEGER`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_comment TEXT`,
  ];
  for (const col of cols) { try { await query(col); } catch {} }
}
ensureCols();

function fmt(o) {
  if (!o) return null;
  return {
    ...o,
    shippingAddr: o.shipping_addr || {},
    listing: {
      id:       o.listing_id,
      title:    o.l_title,
      images:   o.l_images || [],
      category: o.l_category,
    },
    buyer:  { id: o.buyer_id,  username: o.b_username,  displayName: o.b_display },
    seller: { id: o.seller_id, username: o.s_username,  displayName: o.s_display },
  };
}

const BASE = `
  SELECT o.*,
    l.title as l_title, l.images as l_images, l.category as l_category,
    b.username as b_username, b.display_name as b_display,
    s.username as s_username, s.display_name as s_display
  FROM orders o
  LEFT JOIN listings l ON o.listing_id = l.id
  LEFT JOIN users b ON o.buyer_id = b.id
  LEFT JOIN users s ON o.seller_id = s.id
`;

// GET /api/orders/my
router.get('/my', authenticate, async (req, res) => {
  const rows = await queryAll(`${BASE} WHERE o.buyer_id=$1 ORDER BY o.created_at DESC`, [req.user.id]);
  res.json({ orders: rows.map(fmt) });
});

// GET /api/orders/sales
router.get('/sales', authenticate, async (req, res) => {
  const rows = await queryAll(`${BASE} WHERE o.seller_id=$1 ORDER BY o.created_at DESC`, [req.user.id]);
  res.json({ orders: rows.map(fmt) });
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res) => {
  const row = await queryOne(`${BASE} WHERE o.id=$1`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Order not found' });
  if (row.buyer_id !== req.user.id && row.seller_id !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' });
  res.json({ order: fmt(row) });
});

// POST /api/orders/checkout — idempotent: one order per buyer+listing
// Creates the order AND marks it paid in a single step
router.post('/checkout', authenticate, async (req, res) => {
  const { listingId, shippingAddress, paymentMethod } = req.body;

  if (!listingId)        return res.status(400).json({ error: 'listingId is required' });
  if (!shippingAddress?.name || !shippingAddress?.line1 || !shippingAddress?.city)
    return res.status(400).json({ error: 'Complete shipping address is required' });

  const listing = await queryOne('SELECT * FROM listings WHERE id=$1', [listingId]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.seller_id === req.user.id)
    return res.status(400).json({ error: 'You cannot buy your own listing' });

  // Check if this buyer already has an order for this listing — don't create duplicates
  const existing = await queryOne(
    'SELECT * FROM orders WHERE buyer_id=$1 AND listing_id=$2 ORDER BY created_at DESC LIMIT 1',
    [req.user.id, listingId]
  );

  let orderId;

  if (existing) {
    // Update existing order with shipping + paid status
    orderId = existing.id;
    await query(
      `UPDATE orders SET
         shipping_addr=$1,
         status='paid',
         updated_at=NOW()
       WHERE id=$2`,
      [JSON.stringify(shippingAddress), orderId]
    );
  } else {
    // Create new order
    const amount      = listing.type === 'buy_now' ? listing.buynow_price : listing.auction_current;
    const platformFee = (amount || 0) * 0.05;
    orderId = uuid();

    await query(
      `INSERT INTO orders
         (id, buyer_id, seller_id, listing_id, type, amount, platform_fee, total, status, shipping_addr)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'paid',$9)`,
      [
        orderId,
        req.user.id,
        listing.seller_id,
        listing.id,
        listing.type === 'buy_now' ? 'buy_now' : 'auction_win',
        amount,
        platformFee,
        amount,
        JSON.stringify(shippingAddress),
      ]
    );

    // Mark listing as sold (only for buy_now — auction listings are already sold)
    if (listing.type === 'buy_now') {
      await query("UPDATE listings SET status='sold', buynow_sold=buynow_sold+1 WHERE id=$1", [listingId]);
    }
  }

  const row = await queryOne(`${BASE} WHERE o.id=$1`, [orderId]);
  res.status(200).json({ order: fmt(row) });
});

// PUT /api/orders/:id/ship — seller adds tracking
router.put('/:id/ship', authenticate, async (req, res) => {
  const { trackingNumber, carrier } = req.body;
  const order = await queryOne('SELECT * FROM orders WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const row = await queryOne(
    `UPDATE orders SET status='shipped', tracking_number=$1, carrier=$2, shipped_at=NOW(), updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [trackingNumber || '', carrier || 'USPS', req.params.id]
  );
  res.json({ order: fmt(row) });
});

// PUT /api/orders/:id/deliver
router.put('/:id/deliver', authenticate, async (req, res) => {
  const row = await queryOne(
    `UPDATE orders SET status='delivered', delivered_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ order: fmt(row) });
});

// POST /api/orders/:id/review
router.post('/:id/review', authenticate, async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ error: 'Rating 1-5 required' });
  const order = await queryOne('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  await query(
    `UPDATE orders SET review_rating=$1, review_comment=$2, updated_at=NOW() WHERE id=$3`,
    [rating, comment || '', req.params.id]
  );
  await query(
    `UPDATE users SET
       seller_rating  = (SELECT COALESCE(AVG(review_rating),0) FROM orders WHERE seller_id=$1 AND review_rating IS NOT NULL),
       seller_reviews = (SELECT COUNT(*) FROM orders WHERE seller_id=$1 AND review_rating IS NOT NULL)
     WHERE id=$1`,
    [order.seller_id]
  );
  res.json({ ok: true });
});

// PUT /api/orders/:id/cancel — buyer or seller can cancel
router.put('/:id/cancel', authenticate, async (req, res) => {
  const order = await queryOne(
    'SELECT * FROM orders WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)',
    [req.params.id, req.user.id]
  );
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (['shipped','delivered'].includes(order.status))
    return res.status(400).json({ error: 'Cannot cancel a shipped order' });

  const row = await queryOne(
    `UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id=$1 RETURNING *`,
    [req.params.id]
  );

  // Restore listing to active if cancelled
  if (order.status !== 'delivered') {
    await query(
      `UPDATE listings SET status='active', buynow_sold=GREATEST(0,buynow_sold-1) WHERE id=$1`,
      [order.listing_id]
    );
  }

  res.json({ order: fmt(row) });
});

// DELETE /api/orders/:id — remove cancelled order from view
router.delete('/:id', authenticate, async (req, res) => {
  const order = await queryOne(
    'SELECT * FROM orders WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)',
    [req.params.id, req.user.id]
  );
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'cancelled')
    return res.status(400).json({ error: 'Only cancelled orders can be deleted' });

  await query('DELETE FROM orders WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
