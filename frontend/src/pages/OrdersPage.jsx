import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersAPI } from '../services/api.js';
import { useAuthStore } from '../context/authStore.js';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  pending_payment: 'bg-yellow-50 text-yellow-700',
  paid:            'bg-blue-50 text-blue-700',
  processing:      'bg-purple-50 text-purple-700',
  shipped:         'bg-indigo-50 text-indigo-700',
  delivered:       'bg-green-50 text-green-700',
  cancelled:       'bg-red-50 text-red-600',
};
const STATUS_LABELS = {
  pending_payment: 'Awaiting Payment',
  paid:            'Paid',
  processing:      'Processing',
  shipped:         'Shipped',
  delivered:       'Delivered',
  cancelled:       'Cancelled',
};

function OrderCard({ order, isSeller }) {
  const addr = order.shippingAddr || order.shipping_addr || {};
  return (
    <Link to={`/orders/${order.id}`} className="card p-5 hover:border-brand transition-all block">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl">
          {order.listing?.images?.[0]?.url
            ? <img src={order.listing.images[0].url} className="w-full h-full object-cover" alt="" />
            : '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className="font-bold text-sm line-clamp-1">{order.listing?.title || 'Item'}</p>
            <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-500'}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {isSeller ? `Buyer: ${order.buyer?.displayName || order.buyer?.username}` : `Seller: ${order.seller?.displayName || order.seller?.username}`}
          </p>
          <div className="flex items-center justify-between mt-2">
            <p className="font-extrabold text-brand">${order.amount?.toFixed(2)}</p>
            <p className="text-xs text-gray-400">{order.created_at ? formatDistanceToNow(new Date(order.created_at), { addSuffix: true }) : ''}</p>
          </div>
          {order.status === 'pending_payment' && !isSeller && (
            <div className="mt-2">
              <Link to={`/checkout/${order.listing_id}`}
                onClick={e => e.stopPropagation()}
                className="text-xs font-bold text-white bg-brand px-3 py-1.5 rounded-full hover:bg-dz-600 transition-all">
                Complete payment →
              </Link>
            </div>
          )}
          {order.tracking_number && (
            <p className="text-xs text-gray-400 mt-1 font-mono">📦 {order.carrier}: {order.tracking_number}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function OrdersPage() {
  const { user } = useAuthStore();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('purchases');
  const isSeller = user?.role === 'seller' || user?.role === 'admin';

  useEffect(() => {
    setLoading(true);
    const fn = tab === 'purchases' ? ordersAPI.my : ordersAPI.sales;
    fn().then(d => { setOrders(d.orders || []); setLoading(false); }).catch(() => setLoading(false));
  }, [tab]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-6">
        {tab === 'purchases' ? 'My Orders' : 'My Sales'}
      </h1>

      {isSeller && (
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('purchases')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all
              ${tab === 'purchases' ? 'bg-brand2 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            🛍 My Purchases
          </button>
          <button onClick={() => setTab('sales')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all
              ${tab === 'sales' ? 'bg-brand2 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            📦 My Sales
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-3">{tab === 'purchases' ? '🛍' : '📦'}</div>
          <p className="font-semibold text-lg mb-1">{tab === 'purchases' ? 'No purchases yet' : 'No sales yet'}</p>
          <p className="text-sm">
            {tab === 'purchases'
              ? <Link to="/marketplace" className="text-brand underline">Browse the marketplace</Link>
              : <Link to="/seller/listings/new" className="text-brand underline">Create your first listing</Link>}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => <OrderCard key={o.id} order={o} isSeller={tab === 'sales'} />)}
        </div>
      )}
    </div>
  );
}
