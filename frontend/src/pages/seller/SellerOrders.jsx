import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersAPI } from '../../services/api.js';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

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
  paid:            'Paid — needs shipping',
  processing:      'Processing',
  shipped:         'Shipped',
  delivered:       'Delivered',
  cancelled:       'Cancelled',
};

export function SellerOrders() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [shipModal, setShipModal] = useState(null); // orderId
  const [trackingNum, setTrackingNum] = useState('');
  const [carrier, setCarrier]         = useState('USPS');
  const [submitting, setSubmitting]   = useState(false);

  const load = () => {
    setLoading(true);
    ordersAPI.sales()
      .then(d => { setOrders(d.orders || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleShip = async (orderId) => {
    if (!trackingNum) { toast.error('Enter tracking number'); return; }
    setSubmitting(true);
    try {
      await ordersAPI.ship(orderId, { trackingNumber: trackingNum, carrier });
      toast.success('📦 Marked as shipped!');
      setShipModal(null);
      setTrackingNum('');
      load();
    } catch { toast.error('Failed'); }
    setSubmitting(false);
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const stats = {
    total:    orders.length,
    pending:  orders.filter(o => o.status === 'pending_payment').length,
    paid:     orders.filter(o => o.status === 'paid').length,
    shipped:  orders.filter(o => o.status === 'shipped').length,
    revenue:  orders.filter(o => ['paid','shipped','delivered'].includes(o.status)).reduce((s, o) => s + (o.amount || 0), 0),
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold mb-6">Orders</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total orders',      value: stats.total,                       color: 'text-brand2' },
          { label: 'Awaiting payment',  value: stats.pending,                     color: 'text-yellow-600' },
          { label: 'Needs shipping',    value: stats.paid,                        color: 'text-blue-600' },
          { label: 'Revenue',           value: `$${stats.revenue.toFixed(2)}`,    color: 'text-brand' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`text-2xl font-extrabold ${s.color}`}>{loading ? '...' : s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['all','pending_payment','paid','shipped','delivered'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
              ${filter === f ? 'bg-brand2 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
            {f !== 'all' && (
              <span className="ml-1 opacity-60">({orders.filter(o => o.status === f).length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📦</div>
          <p className="font-semibold">No orders {filter !== 'all' ? `with status "${STATUS_LABELS[filter]}"` : 'yet'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden sm:table-cell">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Ship to</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(order => {
                const addr = order.shippingAddr || order.shipping_addr || {};
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-all">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg">
                          {order.listing?.images?.[0]?.url
                            ? <img src={order.listing.images[0].url} className="w-full h-full object-cover" alt="" />
                            : '📦'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold line-clamp-1 max-w-[160px]">{order.listing?.title || 'Item'}</p>
                          <p className="text-xs text-gray-400 font-mono">{order.id.slice(0,8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="text-sm font-semibold">{order.buyer?.displayName || order.buyer?.username}</p>
                      <p className="text-xs text-gray-400">{order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-brand">${order.amount?.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">Fee: ${order.platform_fee?.toFixed(2)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-500'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      {order.tracking_number && (
                        <p className="text-xs text-gray-400 font-mono mt-1">{order.carrier}: {order.tracking_number}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {addr?.name ? (
                        <div className="text-xs text-gray-500">
                          <p className="font-semibold">{addr.name}</p>
                          <p>{addr.line1}</p>
                          <p>{addr.city}, {addr.state} {addr.zip}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Not provided</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Link to={`/orders/${order.id}`} className="text-xs font-semibold text-gray-500 hover:text-brand px-2 py-1 rounded-lg hover:bg-gray-100">
                          View →
                        </Link>
                        {order.status === 'paid' && (
                          <button onClick={() => { setShipModal(order.id); setTrackingNum(''); setCarrier('USPS'); }}
                            className="text-xs font-bold text-white bg-brand px-2 py-1 rounded-lg hover:bg-dz-600">
                            Ship it
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Ship modal */}
      {shipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Add tracking info</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Carrier</label>
                <select value={carrier} onChange={e => setCarrier(e.target.value)} className="input">
                  {['USPS','UPS','FedEx','DHL','Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tracking number</label>
                <input value={trackingNum} onChange={e => setTrackingNum(e.target.value)}
                  className="input font-mono" placeholder="Enter tracking number" autoFocus />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShipModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleShip(shipModal)} disabled={submitting}
                className="btn-primary flex-1 disabled:opacity-60">
                {submitting ? 'Saving...' : 'Mark shipped'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SellerAnalytics() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersAPI.sales()
      .then(({ orders }) => {
        const paid = orders.filter(o => ['paid','shipped','delivered'].includes(o.status));
        const totalRevenue = paid.reduce((s, o) => s + (o.amount || 0), 0);
        const totalFees    = paid.reduce((s, o) => s + (o.platform_fee || 0), 0);
        setData({ totalRevenue, totalFees, netRevenue: totalRevenue - totalFees, orderCount: paid.length });
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold mb-6">Analytics</h1>
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Gross revenue',  value: `$${data?.totalRevenue?.toFixed(2) || '0.00'}`,  color: 'text-brand' },
              { label: 'Net earnings',   value: `$${data?.netRevenue?.toFixed(2)   || '0.00'}`,  color: 'text-green-600' },
              { label: 'Platform fees',  value: `$${data?.totalFees?.toFixed(2)    || '0.00'}`,  color: 'text-gray-500' },
              { label: 'Orders',         value: data?.orderCount || 0,                            color: 'text-brand2' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold mb-4">Revenue breakdown</h2>
            {[
              { label: 'Gross revenue',  val: data?.totalRevenue || 0, pct: 100 },
              { label: 'Platform fee (5%)', val: data?.totalFees || 0, pct: 5 },
              { label: 'Net earnings',   val: data?.netRevenue || 0, pct: data?.totalRevenue ? Math.round((data.netRevenue/data.totalRevenue)*100) : 0 },
            ].map(row => (
              <div key={row.label} className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{row.label}</span>
                  <span className="font-bold text-brand">${row.val.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(row.pct,100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default SellerOrders;
