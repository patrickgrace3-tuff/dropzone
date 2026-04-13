import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { showsAPI } from '../services/api.js';
import { formatDistanceToNow, format } from 'date-fns';

export default function LiveShowsPage() {
  const [params, setParams] = useSearchParams();
  const [shows, setShows]   = useState([]);
  const [loading, setLoading] = useState(true);
  const status = params.get('status') || 'live';

  useEffect(() => {
    setLoading(true);
    showsAPI.list({ status, limit: 24 })
      .then(d => { setShows(d.shows || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const tabs = [
    { key: 'live',      label: '🔴 Live Now' },
    { key: 'scheduled', label: '📅 Upcoming' },
    { key: 'ended',     label: '📼 Past Shows' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold">Live Shows</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 pb-0">
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => { const n = new URLSearchParams(); n.set('status', t.key); setParams(n); }}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px
              ${status === t.key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-brand2'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-video bg-gray-100 rounded-t-2xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : shows.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <div className="text-6xl mb-4">{status === 'live' ? '📡' : status === 'scheduled' ? '📅' : '📼'}</div>
          <p className="text-lg font-semibold mb-1">
            {status === 'live' ? 'No live shows right now' : status === 'scheduled' ? 'No upcoming shows' : 'No past shows'}
          </p>
          <p className="text-sm">Check back soon or start your own show</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {shows.map(show => (
            <Link key={show.id} to={`/shows/${show.id}`}
              className="card hover:border-brand hover:shadow-md transition-all group overflow-hidden">
              {/* Thumbnail */}
              <div className="aspect-video bg-brand2 relative overflow-hidden flex items-center justify-center">
                {show.thumbnail
                  ? <img src={show.thumbnail} alt={show.title} className="w-full h-full object-cover" />
                  : <div className="text-5xl">🎬</div>
                }
                {show.status === 'live' && (
                  <div className="absolute top-2 left-2 badge-live text-[10px]">
                    <span className="live-dot" /> LIVE
                  </div>
                )}
                {show.status === 'live' && (
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-mono px-2 py-1 rounded-full">
                    👁 {show.viewerCount}
                  </div>
                )}
                {show.status === 'scheduled' && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {format(new Date(show.scheduledAt), 'MMM d · h:mm a')}
                  </div>
                )}
              </div>

              <div className="p-4">
                <p className="font-bold text-sm line-clamp-2 mb-1">{show.title}</p>
                <p className="text-xs text-gray-400 mb-2">
                  by {show.seller?.displayName || show.seller?.username}
                  {show.seller?.sellerProfile?.rating > 0 && ` · ⭐ ${show.seller.sellerProfile.rating.toFixed(1)}`}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{show.inventory?.length || 0} items</span>
                  {show.status === 'ended' && show.endedAt && (
                    <span>{formatDistanceToNow(new Date(show.endedAt), { addSuffix: true })}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
