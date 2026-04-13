import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { listingsAPI, showsAPI } from '../services/api.js';
import ListingCard from '../components/marketplace/ListingCard.jsx';

const CATEGORIES = [
  { key: 'sneakers',     label: 'Sneakers',    emoji: '👟' },
  { key: 'cards',        label: 'Cards',       emoji: '🃏' },
  { key: 'tech',         label: 'Tech',        emoji: '💻' },
  { key: 'vintage',      label: 'Vintage',     emoji: '📷' },
  { key: 'streetwear',   label: 'Streetwear',  emoji: '🧥' },
  { key: 'collectibles', label: 'Collectibles',emoji: '🏆' },
];

export default function HomePage() {
  const [featured, setFeatured]   = useState([]);
  const [endingSoon, setEndingSoon]= useState([]);
  const [liveShows, setLiveShows] = useState([]);

  useEffect(() => {
    listingsAPI.browse({ limit: 8, sort: 'popular' }).then(d => setFeatured(d.listings || [])).catch(() => {});
    listingsAPI.browse({ limit: 6, sort: 'ending' }).then(d => setEndingSoon(d.listings || [])).catch(() => {});
    showsAPI.list({ status: 'live', limit: 4 }).then(d => setLiveShows(d.shows || [])).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand2 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-bold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-live rounded-full animate-pulse-fast" /> Live auctions happening now
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none mb-6">
            Bid. Buy. Sell.<br /><span className="text-brand">Go Live.</span>
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">
            The marketplace where every drop matters. Auction rare finds, host live shows, and connect with buyers worldwide.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/marketplace" className="bg-brand text-white font-bold px-8 py-3.5 rounded-full text-base hover:bg-dz-600 transition-all">
              Browse marketplace
            </Link>
            <Link to="/shows" className="bg-white/10 text-white font-bold px-8 py-3.5 rounded-full text-base hover:bg-white/20 transition-all">
              Watch live shows →
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-14">

        {/* Live Shows strip */}
        {liveShows.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title flex items-center gap-2">
                <span className="badge-live text-xs">LIVE</span> Shows happening now
              </h2>
              <Link to="/shows?status=live" className="text-sm text-brand font-semibold hover:underline">See all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {liveShows.map(show => (
                <Link key={show.id} to={`/shows/${show.id}`}
                  className="card p-4 hover:border-live transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge-live text-[10px]"><span className="live-dot" /> LIVE</span>
                    <span className="text-xs text-gray-400 font-mono">{show.viewerCount} watching</span>
                  </div>
                  <div className="font-bold text-sm line-clamp-1">{show.title}</div>
                  <div className="text-xs text-gray-400 mt-1">by {show.seller?.displayName || show.seller?.username}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section>
          <h2 className="section-title">Shop by category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {CATEGORIES.map(cat => (
              <Link key={cat.key} to={`/marketplace?category=${cat.key}`}
                className="card p-4 text-center hover:border-brand hover:shadow transition-all group cursor-pointer">
                <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">{cat.emoji}</div>
                <div className="text-xs font-bold text-gray-600">{cat.label}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Ending soon */}
        {endingSoon.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">⏱ Ending soon</h2>
              <Link to="/marketplace?sort=ending" className="text-sm text-brand font-semibold hover:underline">View all →</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {endingSoon.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          </section>
        )}

        {/* Featured */}
        {featured.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Featured listings</h2>
              <Link to="/marketplace" className="text-sm text-brand font-semibold hover:underline">View all →</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {featured.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          </section>
        )}

        {/* Sell CTA */}
        <section className="bg-brand2 text-white rounded-3xl p-10 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h2 className="text-3xl font-extrabold mb-3">Start selling today</h2>
          <p className="text-white/60 mb-6 max-w-md mx-auto">List items for auction, set up live shows, and reach thousands of buyers. Free to join.</p>
          <Link to="/register" className="inline-block bg-brand text-white font-bold px-8 py-3.5 rounded-full hover:bg-dz-600 transition-all">
            Create seller account
          </Link>
        </section>
      </div>
    </div>
  );
}
