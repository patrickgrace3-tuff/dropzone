import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { queryOne, queryAll, query } from '../config/db.js';
import { authenticate, requireSeller } from '../middleware/auth.js';

const router = Router();

async function withSeller(show) {
  if (!show) return null;
  const seller = await queryOne('SELECT id, username, display_name, avatar, seller_rating FROM users WHERE id=$1', [show.seller_id]);
  return {
    id:           show.id,
    sellerId:     show.seller_id,
    title:        show.title,
    description:  show.description,
    scheduledAt:  show.scheduled_at,
    startedAt:    show.started_at,
    endedAt:      show.ended_at,
    status:       show.status,
    streamKey:    show.stream_key,
    playbackId:   show.playback_id,
    inventory:    show.inventory || [],
    currentItemIndex: show.current_item_index,
    viewerCount:  show.viewer_count,
    totalRevenue: show.total_revenue,
    chatEnabled:  show.chat_enabled,
    category:     show.category,
    tags:         show.tags || [],
    thumbnail:    show.thumbnail,
    createdAt:    show.created_at,
    seller: seller ? {
      id: seller.id, username: seller.username,
      displayName: seller.display_name, avatar: seller.avatar,
      sellerProfile: { rating: seller.seller_rating },
    } : null,
  };
}

router.get('/', async (req, res) => {
  const { status, limit = 20 } = req.query;
  const rows = status
    ? await queryAll('SELECT * FROM live_shows WHERE status=$1 ORDER BY created_at DESC LIMIT $2', [status, Number(limit)])
    : await queryAll('SELECT * FROM live_shows ORDER BY created_at DESC LIMIT $1', [Number(limit)]);
  const shows = await Promise.all(rows.map(withSeller));
  res.json({ shows });
});

router.get('/:id', async (req, res) => {
  const row = await queryOne('SELECT * FROM live_shows WHERE id=$1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Show not found' });
  res.json({ show: await withSeller(row) });
});

router.post('/', authenticate, requireSeller, async (req, res) => {
  const { title, description = '', scheduledAt, category = '', tags = [], chatEnabled = true } = req.body;
  if (!title || !scheduledAt) return res.status(400).json({ error: 'title and scheduledAt required' });
  const id  = uuid();
  const row = await queryOne(
    `INSERT INTO live_shows (id, seller_id, title, description, scheduled_at, category, tags, chat_enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, req.user.id, title, description, scheduledAt, category, JSON.stringify(tags), chatEnabled]
  );
  res.status(201).json({ show: await withSeller(row) });
});

router.post('/:id/start', authenticate, requireSeller, async (req, res) => {
  let show = await queryOne('SELECT * FROM live_shows WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
  if (!show) return res.status(404).json({ error: 'Not found' });

  const inventory = show.inventory || [];
  const firstIdx  = inventory.findIndex(i => i.status === 'queued');
  let currentItem = null;

  if (firstIdx !== -1) {
    inventory[firstIdx].status    = 'active';
    inventory[firstIdx].startedAt = new Date().toISOString();
    inventory[firstIdx].currentBid = inventory[firstIdx].startingBid;
    currentItem = inventory[firstIdx];
    const listingId = currentItem.listing?.id || currentItem.listing;
    await query('UPDATE listings SET is_live_active=true, live_show_id=$1 WHERE id=$2', [req.params.id, listingId]);
  }

  show = await queryOne(
    `UPDATE live_shows SET status='live', started_at=NOW(), stream_key=$1, playback_id=$2,
     inventory=$3, current_item_index=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
    [`sk_${req.user.id}_${Date.now()}`, `pb_${req.params.id}`,
     JSON.stringify(inventory), firstIdx, req.params.id]
  );

  req.io.emit('show:started', { showId: show.id, seller: req.user.username });
  if (currentItem) req.io.to(`show:${show.id}`).emit('show:next-item', { item: currentItem, index: firstIdx });

  res.json({ show: await withSeller(show), currentItem });
});

router.post('/:id/end', authenticate, requireSeller, async (req, res) => {
  const show = await queryOne(
    "UPDATE live_shows SET status='ended', ended_at=NOW(), updated_at=NOW() WHERE id=$1 AND seller_id=$2 RETURNING *",
    [req.params.id, req.user.id]
  );
  if (!show) return res.status(404).json({ error: 'Not found' });
  req.io.to(`show:${req.params.id}`).emit('show:ended', { showId: req.params.id });
  res.json({ show: await withSeller(show) });
});

router.post('/:id/inventory', authenticate, requireSeller, async (req, res) => {
  const show    = await queryOne('SELECT * FROM live_shows WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
  if (!show) return res.status(404).json({ error: 'Not found' });
  const listing = await queryOne('SELECT id, title, images, category FROM listings WHERE id=$1', [req.body.listingId]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const inventory = show.inventory || [];
  inventory.push({
    listing:     { id: listing.id, title: listing.title, images: listing.images, category: listing.category },
    order:       inventory.length,
    startingBid: req.body.startingBid || 0,
    currentBid:  req.body.startingBid || 0,
    bidDuration: req.body.bidDuration || 120,
    status:      'queued',
    startedAt: null, endedAt: null, soldPrice: null,
  });

  const updated = await queryOne(
    'UPDATE live_shows SET inventory=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
    [JSON.stringify(inventory), req.params.id]
  );
  res.json({ show: await withSeller(updated) });
});

router.post('/:id/next-item', authenticate, requireSeller, async (req, res) => {
  const show      = await queryOne('SELECT * FROM live_shows WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
  if (!show) return res.status(404).json({ error: 'Not found' });
  const inventory = show.inventory || [];
  const curIdx    = show.current_item_index;
  const cur       = inventory[curIdx];

  if (cur && cur.status === 'active') {
    cur.status  = 'skipped';
    cur.endedAt = new Date().toISOString();
    const lid   = cur.listing?.id || cur.listing;
    await query('UPDATE listings SET is_live_active=false WHERE id=$1', [lid]);
  }

  const nextIdx = inventory.findIndex((i, idx) => idx > curIdx && i.status === 'queued');
  let nextItem  = null;
  if (nextIdx !== -1) {
    inventory[nextIdx].status     = 'active';
    inventory[nextIdx].startedAt  = new Date().toISOString();
    inventory[nextIdx].currentBid = inventory[nextIdx].startingBid;
    nextItem = inventory[nextIdx];
    const lid = nextItem.listing?.id || nextItem.listing;
    await query('UPDATE listings SET is_live_active=true, live_show_id=$1 WHERE id=$2', [req.params.id, lid]);
    req.io.to(`show:${req.params.id}`).emit('show:next-item', { item: nextItem, index: nextIdx });
  }

  const updated = await queryOne(
    'UPDATE live_shows SET inventory=$1, current_item_index=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
    [JSON.stringify(inventory), nextIdx !== -1 ? nextIdx : curIdx, req.params.id]
  );
  res.json({ show: await withSeller(updated), currentItem: nextItem });
});

router.post('/:id/hammer', authenticate, requireSeller, async (req, res) => {
  const { finalPrice, listingId } = req.body;
  const show      = await queryOne('SELECT * FROM live_shows WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
  if (!show) return res.status(404).json({ error: 'Not found' });
  const inventory = show.inventory || [];
  const curIdx    = show.current_item_index;
  const cur       = inventory[curIdx];

  if (cur) {
    cur.status    = 'sold';
    cur.soldPrice = finalPrice;
    cur.endedAt   = new Date().toISOString();
    const lid = cur.listing?.id || cur.listing;
    await query("UPDATE listings SET status='sold', is_live_active=false WHERE id=$1", [lid]);
  }

  // Auto-advance
  const nextIdx = inventory.findIndex((i, idx) => idx > curIdx && i.status === 'queued');
  let nextItem  = null;
  if (nextIdx !== -1) {
    inventory[nextIdx].status     = 'active';
    inventory[nextIdx].startedAt  = new Date().toISOString();
    inventory[nextIdx].currentBid = inventory[nextIdx].startingBid;
    nextItem = inventory[nextIdx];
    const lid = nextItem.listing?.id || nextItem.listing;
    await query('UPDATE listings SET is_live_active=true, live_show_id=$1 WHERE id=$2', [req.params.id, lid]);
    req.io.to(`show:${req.params.id}`).emit('show:next-item', { item: nextItem, index: nextIdx });
  }

  const newRevenue = (show.total_revenue || 0) + (finalPrice || 0);
  const updated = await queryOne(
    'UPDATE live_shows SET inventory=$1, current_item_index=$2, total_revenue=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
    [JSON.stringify(inventory), nextIdx !== -1 ? nextIdx : curIdx, newRevenue, req.params.id]
  );

  req.io.to(`show:${req.params.id}`).emit('show:item:sold', { listingId, finalPrice, nextItem });
  res.json({ show: await withSeller(updated), soldItem: cur, nextItem });
});

export default router;
