import jwt from 'jsonwebtoken';
import { queryOne, queryAll, query } from '../config/db.js';

const SECRET = process.env.JWT_SECRET || 'changeme_secret_please_update';

export function setupSocketHandlers(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = jwt.verify(token, SECRET);
        const user    = await queryOne('SELECT id, username, avatar, role FROM users WHERE id=$1', [payload.userId]);
        if (user) socket.user = user;
      } catch {}
    }
    next();
  });

  io.on('connection', (socket) => {

    socket.on('join:listing', (id) => socket.join(`listing:${id}`));
    socket.on('leave:listing',(id) => socket.leave(`listing:${id}`));

    socket.on('join:show', async (showId) => {
      socket.join(`show:${showId}`);
      await query('UPDATE live_shows SET viewer_count=viewer_count+1 WHERE id=$1', [showId]);
      const show = await queryOne('SELECT viewer_count FROM live_shows WHERE id=$1', [showId]);
      io.to(`show:${showId}`).emit('show:viewers', { count: show?.viewer_count || 0 });
    });

    socket.on('leave:show', async (showId) => {
      socket.leave(`show:${showId}`);
      await query('UPDATE live_shows SET viewer_count=GREATEST(0,viewer_count-1) WHERE id=$1', [showId]);
      const show = await queryOne('SELECT viewer_count FROM live_shows WHERE id=$1', [showId]);
      io.to(`show:${showId}`).emit('show:viewers', { count: show?.viewer_count || 0 });
    });

    socket.on('show:chat', ({ showId, message }) => {
      if (!socket.user || !message?.trim() || message.length > 200) return;
      io.to(`show:${showId}`).emit('show:chat', {
        userId: socket.user.id, username: socket.user.username,
        message: message.trim(), ts: Date.now(),
      });
    });

    socket.on('show:bid', async ({ showId, listingId, amount }) => {
      if (!socket.user) return socket.emit('error', { message: 'Must be logged in' });
      const listing = await queryOne('SELECT * FROM listings WHERE id=$1', [listingId]);
      if (!listing?.is_live_active)          return socket.emit('error', { message: 'Item not active' });
      if (amount <= listing.auction_current) return socket.emit('error', { message: 'Bid too low' });

      await query("UPDATE bids SET status='outbid',is_winning=false WHERE listing_id=$1 AND status='active'", [listingId]);
      const bidId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await query("INSERT INTO bids (id,listing_id,bidder_id,amount,is_winning,is_live,show_id) VALUES ($1,$2,$3,$4,true,true,$5)",
        [bidId, listingId, socket.user.id, amount, showId]);
      await query('UPDATE listings SET auction_current=$1,auction_bidder=$2,auction_bids=auction_bids+1 WHERE id=$3',
        [amount, socket.user.id, listingId]);

      io.to(`show:${showId}`).emit('show:bid:new', {
        listingId, amount,
        bidder: { userId: socket.user.id, username: socket.user.username },
        bidCount: listing.auction_bids + 1,
      });
      io.to(`listing:${listingId}`).emit('bid:new', {
        listingId, amount,
        bidder: { username: socket.user.username },
        bidCount: listing.auction_bids + 1,
      });
    });

    socket.on('show:hammer', async ({ showId, listingId, finalPrice }) => {
      if (!socket.user) return;
      const show = await queryOne('SELECT * FROM live_shows WHERE id=$1 AND seller_id=$2', [showId, socket.user.id]);
      if (!show) return;
      const inventory = show.inventory || [];
      const item = inventory.find(i => (i.listing?.id || i.listing) === listingId);
      if (item) { item.status = 'sold'; item.soldPrice = finalPrice; item.endedAt = new Date().toISOString(); }
      await query("UPDATE listings SET status='sold',is_live_active=false WHERE id=$1", [listingId]);
      await query('UPDATE live_shows SET inventory=$1,total_revenue=total_revenue+$2 WHERE id=$3',
        [JSON.stringify(inventory), finalPrice || 0, showId]);
      io.to(`show:${showId}`).emit('show:item:sold', { listingId, finalPrice });
    });

    // WebRTC signaling
    socket.on('webrtc:broadcaster-ready', ({ showId }) => {
      socket.to(`show:${showId}`).emit('webrtc:broadcaster-ready', {
        showId, broadcasterSocketId: socket.id,
      });
    });
    socket.on('webrtc:viewer-ready', ({ showId }) => {
      socket.to(`show:${showId}`).emit('webrtc:new-viewer', {
        viewerSocketId: socket.id, showId,
      });
    });
    socket.on('webrtc:offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('webrtc:offer', { broadcasterSocketId: socket.id, offer });
    });
    socket.on('webrtc:answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('webrtc:answer', { viewerSocketId: socket.id, answer });
    });
    socket.on('webrtc:ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc:ice-candidate', { fromSocketId: socket.id, candidate });
    });
    socket.on('webrtc:stream-ended', ({ showId }) => {
      socket.to(`show:${showId}`).emit('webrtc:stream-ended');
    });

    socket.on('disconnect', () => {});
  });
}
