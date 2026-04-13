import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';

const CATEGORY_EMOJI = {
  sneakers:    '👟',
  cards:       '🃏',
  tech:        '💻',
  vintage:     '📷',
  streetwear:  '🧥',
  collectibles:'🏆',
  jewelry:     '💍',
  art:         '🎨',
  other:       '📦',
};

function Countdown({ endsAt }) {
  const [diff, setDiff] = useState(new Date(endsAt) - new Date());
  useEffect(() => {
    const t = setInterval(() => setDiff(new Date(endsAt) - new Date()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (diff <= 0) return <span className="timer-urgent text-xs font-mono">Ended</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const cls = diff < 3600000 ? 'timer-urgent' : diff < 86400000 ? 'timer-warn' : 'timer-ok';
  return (
    <span className={`text-xs font-mono ${cls}`}>
      ⏱ {h > 0 ? `${h}h ` : ''}{m}m{h === 0 ? ` ${s}s` : ''}
    </span>
  );
}

function ListingImage({ images, category, title }) {
  const [imgError, setImgError] = useState(false);
  const [imgIdx, setImgIdx]     = useState(0);

  // Find first valid image URL
  const validImages = (images || []).filter(img => img?.url);
  const imgUrl      = validImages[imgIdx]?.url;

  if (!imgUrl || imgError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-5xl">
        {CATEGORY_EMOJI[category] || '📦'}
      </div>
    );
  }

  return (
    <img
      src={imgUrl}
      alt={title}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      onError={() => {
        if (imgIdx < validImages.length - 1) {
          setImgIdx(i => i + 1); // try next image
        } else {
          setImgError(true); // show emoji fallback
        }
      }}
    />
  );
}

export default function ListingCard({ listing }) {
  const isAuction = listing.type === 'auction' || listing.type === 'both';
  const isBuyNow  = listing.type === 'buy_now'  || listing.type === 'both';
  const price     = isAuction
    ? (listing.auction?.currentBid || listing.auction?.startingBid || 0)
    : (listing.buyNow?.price || 0);

  return (
    <Link to={`/listing/${listing.id}`}
      className="card hover:border-brand hover:shadow-md transition-all duration-200 group overflow-hidden block">

      {/* Image */}
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        <ListingImage images={listing.images} category={listing.category} title={listing.title} />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          {listing.isLiveActive && (
            <span className="badge-live text-[10px]"><span className="live-dot" /> LIVE</span>
          )}
          {listing.auctionType === 'live_show' && !listing.isLiveActive && (
            <span className="text-[9px] font-bold px-2 py-1 bg-brand2 text-white rounded-full">🎬 LIVE SHOW</span>
          )}
        </div>
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {isAuction && <span className="badge-auction text-[10px]">AUCTION</span>}
          {isBuyNow  && <span className="badge-buynow text-[10px]">BUY NOW</span>}
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <p className="font-bold text-sm leading-tight line-clamp-2 mb-1">{listing.title}</p>
        <p className="text-xs text-gray-400 mb-2">
          by {listing.seller?.displayName || listing.seller?.username}
          {listing.seller?.sellerProfile?.rating > 0 && (
            <span className="ml-1">⭐ {listing.seller.sellerProfile.rating.toFixed(1)}</span>
          )}
        </p>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-extrabold text-brand">${price.toLocaleString()}</div>
            {isAuction && (
              <div className="text-xs text-gray-400">{listing.auction?.bidCount || 0} bids</div>
            )}
          </div>
          <div className="text-right">
            {isAuction && listing.auction?.endsAt && (
              <Countdown endsAt={listing.auction.endsAt} />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
