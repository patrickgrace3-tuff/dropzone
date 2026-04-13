import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentsAPI, listingsAPI, showsAPI } from '../../services/api.js';
import { useAuthStore } from '../../context/authStore.js';

export default function SellerDashboard() {
  const { user } = useAuthStore();
  const [earnings, setEarnings]   = useState(null);
  const [listings, setListings]   = useState([]);
  const [shows, setShows]         = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      paymentsAPI.dashboard(),
      listingsAPI.browse({ status: 'active', limit: 5 }),
      showsAPI.list({ limit: 5 }),
    ]).then(([earn, ls, sh]) => {
      setEarnings(earn);
      setListings(ls.listings || []);
      setShows(sh.shows || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Total revenue',  value: earnings ? `$${earnings.totalRevenue?.toLocaleString()}` : '—', color: 'text-brand' },
    { label: 'Net earnings',   value: earnings ? `$${earnings.netRevenue?.toLocaleString()}`   : '—', color: 'text-green-600' },
    { label: 'Platform fees',  value: earnings ? `$${earnings.totalFees?.toLocaleString()}`    : '—', color: 'text-gray-500' },
    { label: 'Orders',         value: earnings ? earnings.orderCount                           : '—', color: 'text-brand2' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold">
          Hey, {user?.displayName || user?.username} 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">Here's your seller overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className={`text-2xl font-extrabold ${s.color}`}>{loading ? '...' : s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link to="/seller/listings/new"
          className="bg-brand text-white rounded-2xl p-5 hover:bg-dz-600 transition-all group">
          <div className="text-2xl mb-2">📦</div>
          <div className="font-bold">List an item</div>
          <div className="text-white/70 text-sm">Create auction or Buy Now</div>
        </Link>
        <Link to="/seller/shows/new"
          className="bg-brand2 text-white rounded-2xl p-5 hover:opacity-90 transition-all">
          <div className="text-2xl mb-2">🎬</div>
          <div className="font-bold">Start a show</div>
          <div className="text-white/70 text-sm">Schedule a live auction show</div>
        </Link>
        <Link to="/seller/orders"
          className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-brand transition-all">
          <div className="text-2xl mb-2">🛒</div>
          <div className="font-bold text-brand2">View orders</div>
          <div className="text-gray-400 text-sm">Manage your sales</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent listings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Active listings</h2>
            <Link to="/seller/listings" className="text-xs text-brand font-semibold hover:underline">View all →</Link>
          </div>
          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          : listings.length === 0 ? <p className="text-sm text-gray-400">No active listings yet</p>
          : (
            <div className="space-y-2">
              {listings.map(l => (
                <div key={l.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                    {l.images?.[0]?.url ? <img src={l.images[0].url} className="w-full h-full object-cover" alt="" /> : '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{l.title}</p>
                    <p className="text-xs text-gray-400">{l.auction?.bidCount || 0} bids · ${l.auction?.currentBid?.toLocaleString() || l.buyNow?.price?.toLocaleString() || '—'}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${l.type === 'auction' ? 'bg-orange-50 text-orange-600'
                    : l.type === 'buy_now' ? 'bg-green-50 text-green-700'
                    : 'bg-blue-50 text-blue-600'}`}>
                    {l.type === 'buy_now' ? 'BUY NOW' : 'AUCTION'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent shows */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Recent shows</h2>
            <Link to="/seller/shows" className="text-xs text-brand font-semibold hover:underline">View all →</Link>
          </div>
          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          : shows.length === 0 ? <p className="text-sm text-gray-400">No shows yet</p>
          : (
            <div className="space-y-2">
              {shows.map(show => (
                <div key={show.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-brand2 flex items-center justify-center text-xl flex-shrink-0">🎬</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{show.title}</p>
                    <p className="text-xs text-gray-400">{show.inventory?.length || 0} items · {show.viewerCount} views</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${show.status === 'live'      ? 'bg-live text-white'
                    : show.status === 'scheduled' ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-100 text-gray-500'}`}>
                    {show.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
