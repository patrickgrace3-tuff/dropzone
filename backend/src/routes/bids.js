import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { queryOne, queryAll, query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/:listingId', authenticate, async (req, res) => {
  const { amount } = req.body;
  const listing = await queryOne('SELECT * FROM listings WHERE id=$1', [req.params.listingId]);

  if (!listing)                          return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'active')       return res.status(400).json({ error: 'Listing not active' });
  if (listing.type === 'buy_now')        return res.status(400).json({ error: 'Buy Now only listing' });
  if (listing.seller_id === req.user.id) return res.status(400).json({ error: 'Cannot bid on your own listing' });
  if (amount <= listing.auction_current) return res.status(400).json({ error: `Bid must exceed $${listing.auction_current}` });
  if (listing.auction_ends && new Date() > new Date(listing.auction_ends))
    return res.status(400).json({ error: 'Auction has ended' });

  // Mark previous bids as outbid
  await query("UPDATE bids SET status='outbid', is_winning=false WHERE listing_id=$1 AND status='active'", [req.params.listingId]);

  const bidId = uuid();
  await query(
    "INSERT INTO bids (id, listing_id, bidder_id, amount, is_winning, status) VALUES ($1,$2,$3,$4,true,'active')",
    [bidId, req.params.listingId, req.user.id, amount]
  );
  await query(
    'UPDATE listings SET auction_current=$1, auction_bidder=$2, auction_bids=auction_bids+1, updated_at=NOW() WHERE id=$3',
    [amount, req.user.id, req.params.listingId]
  );

  req.io.to(`listing:${req.params.listingId}`).emit('bid:new', {
    listingId: req.params.listingId, amount,
    bidder: { username: req.user.username, avatar: req.user.avatar },
    bidCount: listing.auction_bids + 1,
  });

  res.status(201).json({ bid: { id: bidId, amount, bidder: { username: req.user.username } } });
});

router.get('/listing/:listingId', async (req, res) => {
  const bids = await queryAll(
    `SELECT b.*, u.username, u.avatar FROM bids b JOIN users u ON b.bidder_id=u.id
     WHERE b.listing_id=$1 ORDER BY b.created_at DESC LIMIT 50`,
    [req.params.listingId]
  );
  res.json({ bids: bids.map(b => ({ ...b, bidder: { username: b.username, avatar: b.avatar } })) });
});

router.get('/my/history', authenticate, async (req, res) => {
  const bids = await queryAll(
    `SELECT b.*, l.title as listing_title, l.images as listing_images, l.status as listing_status
     FROM bids b JOIN listings l ON b.listing_id=l.id
     WHERE b.bidder_id=$1 ORDER BY b.created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ bids: bids.map(b => ({ ...b, listing: { title: b.listing_title, images: b.listing_images, status: b.listing_status } })) });
});

export default router;
