import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usersAPI, listingsAPI } from '../services/api.js';
import ListingCard from '../components/marketplace/ListingCard.jsx';

export default function ProfilePage() {
  const { username }  = useParams();
  const [profile, setProfile]   = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      usersAPI.profile(username),
      listingsAPI.browse({ status: 'active', limit: 12 }),
    ]).then(([{ user }, { listings: ls }]) => {
      setProfile(user);
      setListings(ls || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [username]);

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse space-y-6">
      <div className="flex gap-5">
        <div className="w-20 h-20 bg-gray-100 rounded-full" />
        <div className="space-y-2 flex-1">
          <div className="h-6 bg-gray-100 rounded w-40" />
          <div className="h-4 bg-gray-100 rounded w-24" />
        </div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="text-center py-20 text-gray-400">
      <div className="text-5xl mb-3">😕</div>
      <p className="font-semibold">User not found</p>
    </div>
  );

  const sp = profile.sellerProfile || {};

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-3xl font-extrabold text-white flex-shrink-0">
          {profile.avatar
            ? <img src={profile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            : (profile.displayName || profile.username)?.[0]?.toUpperCase()
          }
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">{profile.displayName || profile.username}</h1>
          <p className="text-gray-400 text-sm font-mono">@{profile.username}</p>
          {profile.bio && <p className="text-sm text-gray-600 mt-2 max-w-md">{profile.bio}</p>}
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            {sp.rating > 0 && <span>⭐ <strong>{sp.rating.toFixed(1)}</strong> ({sp.reviewCount} reviews)</span>}
            {sp.totalSales > 0 && <span>📦 <strong>{sp.totalSales}</strong> sales</span>}
            <span className="text-gray-400">Member since {new Date(profile.createdAt).getFullYear()}</span>
          </div>
        </div>
        {profile.role === 'seller' && (
          <span className="px-3 py-1 bg-brand/10 text-brand text-xs font-bold rounded-full">Verified Seller</span>
        )}
      </div>

      {/* Stats (sellers only) */}
      {profile.role === 'seller' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total sales', value: sp.totalSales || 0 },
            { label: 'Avg rating',  value: sp.rating > 0 ? sp.rating.toFixed(1) : '—' },
            { label: 'Revenue',     value: sp.totalRevenue ? `$${sp.totalRevenue.toLocaleString()}` : '—' },
            { label: 'Reviews',     value: sp.reviewCount || 0 },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-2xl font-extrabold text-brand">{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Listings */}
      <div>
        <h2 className="section-title">Active listings</h2>
        {listings.length === 0 ? (
          <p className="text-gray-400 text-sm">No active listings.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}
