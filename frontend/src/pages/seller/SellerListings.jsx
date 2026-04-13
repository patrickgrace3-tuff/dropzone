import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingsAPI } from '../../services/api.js';
import { useAuthStore } from '../../context/authStore.js';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const STATUS_TABS = ['all','draft','active','ended','sold','cancelled'];

export default function SellerListings() {
  const { user }      = useAuthStore();
  const [listings, setListings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState('all');

  const load = (s) => {
    setLoading(true);
    const params = s !== 'all' ? { status: s } : {};
    listingsAPI.bySeller(user.id, params)
      .then(d => { setListings(d.listings || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(status); }, [status]);

  const handlePublish = async (id) => {
    try {
      await listingsAPI.publish(id);
      toast.success('Listing published!');
      load(status);
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  const handleRemove = async (id) => {
    if (!confirm('Cancel this listing?')) return;
    try {
      await listingsAPI.remove(id);
      toast.success('Listing cancelled');
      load(status);
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">My Listings</h1>
        <Link to="/seller/listings/new" className="btn-primary">+ New listing</Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize whitespace-nowrap transition-all
              ${status === s ? 'bg-brand2 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-brand'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-3">📦</div>
          <p className="font-semibold">No listings yet</p>
          <Link to="/seller/listings/new" className="btn-primary mt-4 inline-block">Create your first listing</Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-100">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Item</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Price / Bid</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase hidden lg:table-cell">Ends</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listings.map(l => (
                <tr key={l.id} className="hover:bg-gray-50 transition-all">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg">
                        {l.images?.[0]?.url ? <img src={l.images[0].url} className="w-full h-full object-cover" alt="" /> : '📦'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold line-clamp-1 max-w-[180px]">{l.title}</p>
                        <p className="text-xs text-gray-400 capitalize">{l.category} · {l.condition?.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex flex-col gap-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                      ${l.type === 'auction' ? 'bg-orange-50 text-orange-600'
                      : l.type === 'buy_now' ? 'bg-green-50 text-green-700'
                      : 'bg-blue-50 text-blue-600'}`}>
                      {l.type === 'buy_now' ? 'BUY NOW' : l.type.toUpperCase()}
                    </span>
                    {(l.auctionType === 'live_show') && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand2 text-white">🎬 LIVE ONLY</span>
                    )}
                  </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand text-sm">
                      ${(l.auction?.currentBid || l.buyNow?.price || 0).toLocaleString()}
                    </div>
                    {l.auction?.bidCount > 0 && <div className="text-xs text-gray-400">{l.auction.bidCount} bids</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize
                      ${l.status === 'active'    ? 'bg-green-50 text-green-700'
                      : l.status === 'draft'     ? 'bg-gray-100 text-gray-500'
                      : l.status === 'sold'      ? 'bg-blue-50 text-blue-600'
                      : l.status === 'ended'     ? 'bg-orange-50 text-orange-600'
                      : 'bg-red-50 text-red-600'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400 font-mono">
                    {l.auction?.endsAt ? formatDistanceToNow(new Date(l.auction.endsAt), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link to={`/listing/${l.id}`} className="text-xs font-semibold text-gray-500 hover:text-brand2 px-2 py-1 rounded-lg hover:bg-gray-100">View</Link>
                      {l.status === 'draft' && (
                        <>
                          <Link to={`/seller/listings/${l.id}/edit`} className="text-xs font-semibold text-gray-500 hover:text-brand2 px-2 py-1 rounded-lg hover:bg-gray-100">Edit</Link>
                          <button onClick={() => handlePublish(l.id)} className="text-xs font-semibold text-brand px-2 py-1 rounded-lg hover:bg-brand/5">Publish</button>
                        </>
                      )}
                      {l.status === 'active' && (
                        <button onClick={() => handleRemove(l.id)} className="text-xs font-semibold text-red-500 px-2 py-1 rounded-lg hover:bg-red-50">Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
