import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { listingsAPI, bidsAPI } from '../services/api.js';
import { getSocket, joinListing, leaveListing } from '../services/socket.js';
import { useAuthStore } from '../context/authStore.js';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export default function ListingPage() {
  const { id }           = useParams();
  const { user }         = useAuthStore();
  const [listing, setListing] = useState(null);
  const [bids, setBids]       = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const priceRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    listingsAPI.get(id)
      .then(({ listing: l, recentBids }) => {
        setListing(l);
        setBids(recentBids || []);
        setBidAmount((l.auction?.currentBid || 0) + 5);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    joinListing(id);
    const socket = getSocket();

    socket.on('bid:new', ({ listingId, amount, bidder, bidCount }) => {
      if (listingId !== id) return;
      setListing(l => l ? { ...l, auction: { ...l.auction, currentBid: amount, bidCount } } : l);
      setBids(prev => [{ _id: Date.now(), amount, bidder, createdAt: new Date() }, ...prev].slice(0, 20));
      // Flash animation
      if (priceRef.current) {
        priceRef.current.classList.add('bid-flash');
        setTimeout(() => priceRef.current?.classList.remove('bid-flash'), 600);
      }
    });

    return () => {
      leaveListing(id);
      socket.off('bid:new');
    };
  }, [id]);

  const placeBid = async () => {
    if (!user) { toast.error('Sign in to bid'); return; }
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= (listing.auction?.currentBid || 0)) {
      toast.error('Bid must exceed current price'); return;
    }
    setBidding(true);
    try {
      await bidsAPI.place(id, amount);
      toast.success('🎉 Bid placed! You\'re the highest bidder.');
      setBidAmount(amount + 5);
    } catch (err) {
      toast.error(err.error || 'Bid failed');
    }
    setBidding(false);
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-100 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="h-20 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );

  if (!listing) return (
    <div className="text-center py-20 text-gray-400">
      <div className="text-5xl mb-3">😕</div>
      <p className="font-semibold">Listing not found</p>
    </div>
  );

  const isAuction = listing.type === 'auction' || listing.type === 'both';
  const isBuyNow  = listing.type === 'buy_now'  || listing.type === 'both';
  const images    = listing.images || [];
  const mainImg   = images[activeImg]?.url;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Images */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-3">
            {mainImg
              ? <img src={mainImg} alt={listing.title} className="w-full h-full object-cover"
                  onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                />
              : null}
            <div className="w-full h-full items-center justify-center text-8xl"
              style={{ display: mainImg ? 'none' : 'flex' }}>
              {listing.category === 'sneakers' ? '👟'
                : listing.category === 'cards'   ? '🃏'
                : listing.category === 'tech'    ? '💻'
                : listing.category === 'vintage' ? '📷'
                : '📦'}
            </div>
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${i === activeImg ? 'border-brand' : 'border-transparent'}`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover"
                    onError={e => { e.target.style.display='none'; }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {listing.isLiveActive && <span className="badge-live"><span className="live-dot" /> LIVE NOW</span>}
            {isAuction && <span className="badge-auction">AUCTION</span>}
            {isBuyNow  && <span className="badge-buynow">BUY NOW</span>}
            <span className="text-xs text-gray-400 font-mono capitalize px-2 py-1 bg-gray-50 rounded-full">{listing.condition?.replace('_', ' ')}</span>
          </div>

          <h1 className="text-2xl font-extrabold mb-2 leading-tight">{listing.title}</h1>
          <p className="text-sm text-gray-500 mb-4">
            Sold by <span className="font-semibold text-brand2">{listing.seller?.displayName || listing.seller?.username}</span>
            {listing.seller?.sellerProfile?.rating > 0 && ` · ⭐ ${listing.seller.sellerProfile.rating.toFixed(1)}`}
          </p>

          {/* Auction box */}
          {isAuction && (
            <div className="card p-4 mb-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current bid</div>
              <div ref={priceRef} className="text-4xl font-extrabold text-brand mb-1 transition-all">
                ${listing.auction?.currentBid?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-gray-500 mb-4">
                {listing.auction?.bidCount || 0} bids
                {listing.auction?.endsAt && ` · Ends ${formatDistanceToNow(new Date(listing.auction.endsAt), { addSuffix: true })}`}
              </div>
              <div className="flex gap-2">
                <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)}
                  className="input flex-1 font-mono text-base" min={listing.auction?.currentBid + 1} step="1" />
                <button onClick={placeBid} disabled={bidding}
                  className="btn-primary px-6 disabled:opacity-60">
                  {bidding ? '...' : 'Bid now'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Min bid: <strong>${((listing.auction?.currentBid || 0) + 1).toLocaleString()}</strong>
              </p>
            </div>
          )}

          {/* Buy Now */}
          {isBuyNow && listing.buyNow?.price && (
            <div className="card p-4 mb-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Buy it now</div>
              <div className="text-3xl font-extrabold mb-3">${listing.buyNow.price.toLocaleString()}</div>
              <button className="w-full bg-brand2 text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all">
                Buy Now
              </button>
            </div>
          )}

          {/* Description */}
          <div className="mb-6">
            <h3 className="font-bold mb-2">Description</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{listing.description}</p>
          </div>

          {/* Shipping */}
          {listing.shipping?.freeShipping && (
            <div className="text-sm text-green-600 font-semibold">✓ Free shipping</div>
          )}
        </div>
      </div>

      {/* Bid history */}
      {bids.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title">Bid history</h2>
          <div className="card divide-y divide-gray-50">
            {bids.map((bid, i) => (
              <div key={bid.id || i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold">
                    {bid.bidder?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-sm font-semibold">{bid.bidder?.username || 'Anonymous'}</span>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-brand">${bid.amount?.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">
                    {bid.createdAt ? formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true }) : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
