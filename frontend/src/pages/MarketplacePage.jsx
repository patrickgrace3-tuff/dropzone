import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listingsAPI } from '../services/api.js';
import ListingCard from '../components/marketplace/ListingCard.jsx';

const CATEGORIES = ['sneakers','cards','tech','vintage','streetwear','collectibles','jewelry','art','other'];
const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest first' },
  { value: 'ending',     label: 'Ending soon'  },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'popular',    label: 'Most popular' },
];

export default function MarketplacePage() {
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [loading, setLoading]   = useState(false);
  const [q, setQ]               = useState(params.get('q') || '');

  const category = params.get('category') || '';
  const type     = params.get('type') || '';
  const sort     = params.get('sort') || 'newest';
  const page     = Number(params.get('page') || 1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listingsAPI.browse({ q, category, type, sort, page, limit: 24 });
      setListings(data.listings || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch { setListings([]); }
    setLoading(false);
  }, [q, category, type, sort, page]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    next.delete('page');
    setParams(next);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilter('q', q);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-6">Marketplace</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input value={q} onChange={e => setQ(e.target.value)}
          className="input flex-1 text-base"
          placeholder="Search sneakers, cards, tech, vintage..." />
        <button type="submit" className="btn-primary px-6">Search</button>
      </form>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className="hidden md:block w-48 flex-shrink-0 space-y-6">
          <div>
            <div className="label">Category</div>
            <div className="space-y-1">
              <button onClick={() => setFilter('category', '')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${!category ? 'bg-brand text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                All
              </button>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setFilter('category', c)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${category === c ? 'bg-brand text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">Type</div>
            <div className="space-y-1">
              {[['', 'All'], ['auction', 'Auction'], ['buy_now', 'Buy Now'], ['both', 'Both']].map(([v, l]) => (
                <button key={v} onClick={() => setFilter('type', v)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${type === v ? 'bg-brand text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{total.toLocaleString()} results</p>
            <select value={sort} onChange={e => setFilter('sort', e.target.value)}
              className="input w-auto text-sm py-1.5">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-square bg-gray-100 rounded-t-2xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-100 rounded" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-semibold">No listings found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {listings.map(l => <ListingCard key={l.id} listing={l} />)}
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setFilter('page', p)}
                      className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${p === page ? 'bg-brand text-white' : 'bg-white border border-gray-200 hover:border-brand'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
