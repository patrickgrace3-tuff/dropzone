import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { showsAPI } from '../../services/api.js';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function SellerShows() {
  const [shows, setShows]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    showsAPI.list({ limit: 50 })
      .then(d => { setShows(d.shows || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStart = async (id) => {
    try { await showsAPI.start(id); toast.success('Show is live! 🎬'); load(); }
    catch (err) { toast.error(err.error || 'Failed to start show'); }
  };

  const handleEnd = async (id) => {
    if (!confirm('End this show?')) return;
    try { await showsAPI.end(id); toast.success('Show ended'); load(); }
    catch (err) { toast.error(err.error || 'Failed'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold">Live Shows</h1>
        <Link to="/seller/shows/new" className="btn-primary">+ New show</Link>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : shows.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-3">🎬</div>
          <p className="font-semibold mb-1">No shows yet</p>
          <p className="text-sm mb-4">Create your first live auction show</p>
          <Link to="/seller/shows/new" className="btn-primary inline-block">Create show</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shows.map(show => (
            <div key={show.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand2 flex items-center justify-center text-2xl flex-shrink-0">🎬</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold">{show.title}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${show.status === 'live'      ? 'bg-live text-white'
                    : show.status === 'scheduled' ? 'bg-blue-50 text-blue-600'
                    : show.status === 'ended'     ? 'bg-gray-100 text-gray-500'
                    : 'bg-gray-100 text-gray-400'}`}>
                    {show.status === 'live' ? '🔴 LIVE' : show.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {show.inventory?.length || 0} items ·
                  {show.status === 'scheduled' && show.scheduledAt && ` Scheduled ${format(new Date(show.scheduledAt), 'MMM d, h:mm a')}`}
                  {show.status === 'live' && ` ${show.viewerCount} watching`}
                  {show.status === 'ended' && ` $${show.totalRevenue?.toLocaleString() || 0} revenue`}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {show.status === 'live' && (
                  <Link to={`/seller/shows/${show.id}/studio`} className="btn-primary text-xs">Go to Studio</Link>
                )}
                {show.status === 'scheduled' && (
                  <>
                    <Link to={`/seller/shows/${show.id}/studio`} className="btn-secondary text-xs">Setup</Link>
                    <button onClick={() => handleStart(show.id)} className="btn-primary text-xs">Go Live</button>
                  </>
                )}
                {show.status === 'live' && (
                  <button onClick={() => handleEnd(show.id)} className="text-xs font-bold text-red-500 px-3 py-1.5 rounded-xl border border-red-200 hover:bg-red-50">End Show</button>
                )}
                <Link to={`/shows/${show.id}`} className="text-xs font-semibold text-gray-400 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-gray-300">View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
