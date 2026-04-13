import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { queryOne, queryAll, query } from '../config/db.js';
import { authenticate, requireSeller } from '../middleware/auth.js';

const router = Router();

function toJS(l) {
  if (!l) return null;
  return {
    id:          l.id,
    sellerId:    l.seller_id,
    title:       l.title,
    description: l.description,
    category:    l.category,
    condition:   l.condition,
    images:      l.images || [],
    tags:        l.tags   || [],
    type:        l.type,
    auctionType: l.auction_type || 'standard',
    status:      l.status,
    views:       l.views,
    isLiveActive:l.is_live_active,
    liveShowId:  l.live_show_id,
    createdAt:   l.created_at,
    updatedAt:   l.updated_at,
    auction: {
      startingBid:  l.auction_start,
      currentBid:   l.auction_current,
      currentBidder:l.auction_bidder,
      bidCount:     l.auction_bids,
      reservePrice: l.auction_reserve,
      endsAt:       l.auction_ends,
      duration:     l.auction_duration,
    },
    buyNow: {
      price:    l.buynow_price,
      quantity: l.buynow_qty,
      sold:     l.buynow_sold,
    },
    shipping: {
      freeShipping: l.shipping_free,
      weight:       l.shipping_weight,
    },
    seller: l.seller_id ? {
      id:           l.s_id,
      username:     l.s_username,
      displayName:  l.s_display_name,
      avatar:       l.s_avatar,
      sellerProfile:{ rating: l.s_rating, reviewCount: l.s_reviews },
    } : null,
  };
}

const BASE = `
  SELECT l.*, u.id as s_id, u.username as s_username,
         u.display_name as s_display_name, u.avatar as s_avatar,
         u.seller_rating as s_rating, u.seller_reviews as s_reviews
  FROM listings l
  LEFT JOIN users u ON l.seller_id = u.id
`;

// GET /api/listings
router.get('/', async (req, res) => {
  const { q, category, type, status = 'active', sort = 'newest', page = 1, limit = 24 } = req.query;

  const conditions = ['l.status = $1', "(l.auction_type = 'standard' OR l.auction_type IS NULL OR l.type = 'buy_now')"];
  const params     = [status];
  let   pi         = 2;

  if (category) { conditions.push(`l.category = $${pi++}`); params.push(category); }
  if (type)     { conditions.push(`l.type = $${pi++}`);     params.push(type); }
  if (q)        { conditions.push(`(l.title ILIKE $${pi} OR l.description ILIKE $${pi})`); params.push(`%${q}%`); pi++; }

  const orderMap = {
    newest:     'l.created_at DESC',
    ending:     'l.auction_ends ASC NULLS LAST',
    price_asc:  'l.auction_current ASC',
    price_desc: 'l.auction_current DESC',
    popular:    'l.views DESC',
  };
  const orderBy = orderMap[sort] || orderMap.newest;
  const offset  = (Number(page) - 1) * Number(limit);

  const rows  = await queryAll(`${BASE} WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy} LIMIT $${pi} OFFSET $${pi+1}`, [...params, Number(limit), offset]);
  const count = await queryOne(`SELECT COUNT(*) as cnt FROM listings l WHERE ${conditions.join(' AND ')}`, params);
  const total = Number(count?.cnt || 0);

  res.json({ listings: rows.map(toJS), total, pages: Math.ceil(total / Number(limit)), page: Number(page) });
});

// GET /api/listings/seller/:sellerId -- must be before /:id
router.get('/seller/:sellerId', async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const conditions = ['l.seller_id = $1'];
  const params     = [req.params.sellerId];
  if (status) { conditions.push('l.status = $2'); params.push(status); }
  const rows  = await queryAll(`${BASE} WHERE ${conditions.join(' AND ')} ORDER BY l.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, Number(limit), (Number(page)-1)*Number(limit)]);
  const count = await queryOne(`SELECT COUNT(*) as cnt FROM listings l WHERE ${conditions.join(' AND ')}`, params);
  res.json({ listings: rows.map(toJS), total: Number(count?.cnt || 0) });
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  const row = await queryOne(`${BASE} WHERE l.id = $1`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Listing not found' });
  await query('UPDATE listings SET views = views + 1 WHERE id = $1', [req.params.id]);

  const bids = await queryAll(
    `SELECT b.*, u.username, u.avatar FROM bids b JOIN users u ON b.bidder_id = u.id
     WHERE b.listing_id = $1 ORDER BY b.created_at DESC LIMIT 10`,
    [req.params.id]
  );
  res.json({
    listing:    toJS(row),
    recentBids: bids.map(b => ({ ...b, bidder: { username: b.username, avatar: b.avatar } })),
  });
});

// POST /api/listings
router.post('/', authenticate, requireSeller, async (req, res) => {
  const { title, description, category, condition, type, images = [], tags = [], auction = {}, buyNow = {}, shipping = {} } = req.body;
  if (!title || !description || !category || !condition || !type)
    return res.status(400).json({ error: 'title, description, category, condition and type are required' });

  const id  = uuid();
  const row = await queryOne(
    `INSERT INTO listings
       (id, seller_id, title, description, category, condition, type, images, tags,
        auction_start, auction_current, auction_duration, auction_reserve,
        buynow_price, buynow_qty, shipping_free, shipping_weight, auction_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [
      id, req.user.id, title, description, category, condition, type,
      JSON.stringify(images), JSON.stringify(tags),
      auction.startingBid || 0, auction.startingBid || 0,
      auction.duration || 7, auction.reservePrice || null,
      buyNow.price || null, buyNow.quantity || 1,
      shipping.freeShipping ? true : false, shipping.weight || null,
      req.body.auctionType || 'standard',
    ]
  );
  res.status(201).json({ listing: toJS(row) });
});

// POST /api/listings/:id/publish
router.post('/:id/publish', authenticate, requireSeller, async (req, res) => {
  const listing = await queryOne('SELECT * FROM listings WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
  if (!listing) return res.status(404).json({ error: 'Not found' });

  const endsAt = new Date(Date.now() + listing.auction_duration * 86400000);
  const row    = await queryOne(
    `UPDATE listings SET status='active', auction_ends=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [endsAt, req.params.id]
  );
  req.io.emit('listing:new', { listing: toJS(row) });
  res.json({ listing: toJS(row) });
});

// DELETE /api/listings/:id
router.delete('/:id', authenticate, requireSeller, async (req, res) => {
  await query("UPDATE listings SET status='cancelled' WHERE id=$1 AND seller_id=$2", [req.params.id, req.user.id]);
  res.json({ message: 'Listing cancelled' });
});

export { toJS as listingToJS };
export default router;
