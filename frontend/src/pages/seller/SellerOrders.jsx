import { useEffect, useState } from 'react';
import { usersAPI, paymentsAPI } from '../../services/api.js';
import { format } from 'date-fns';

export function SellerOrders() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('sales');

  useEffect(() => {
    const fn = tab === 'sales' ? usersAPI.mySales : usersAPI.myOrders;
    fn().then(d => { setOrders(d.orders || []); setLoading(false); }).catch(() => setLoading(false));
  }, [tab]);

  const STATUS_COLORS = {
    pending_payment: 'bg-yellow-50 text-yellow-700',
    paid:            'bg-blue-50 text-blue-600',
    processing:      'bg-blue-50 text-blue-600',
    shipped:         'bg-purple-50 text-purple-600',
    delivered:       'bg-green-50 text-green-700',
    refunded:        'bg-gray-100 text-gray-500',
    cancelled:       'bg-red-50 text-red-600',
    disputed:        'bg-orange-50 text-orange-600',
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold mb-6">Orders</h1>

      <div className="flex gap-2 mb-6">
        {['sales','purchases'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all
              ${tab === t ? 'bg-brand2 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🛒</div>
          <p className="font-semibold">No {tab} yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden sm:table-cell">{tab === 'sales' ? 'Buyer' : 'Seller'}</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-lg">
                        {order.listing?.images?.[0]?.url
                          ? <img src={order.listing.images[0].url} className="w-full h-full object-cover" alt="" />
                          : '📦'}
                      </div>
                      <p className="text-sm font-semibold line-clamp-1 max-w-[150px]">{order.listing?.title}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-gray-600">
                    {tab === 'sales' ? (order.buyer?.displayName || order.buyer?.username) : (order.seller?.displayName || order.seller?.username)}
                  </td>
                  <td className="px-4 py-3 font-bold text-brand">${order.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-500'}`}>
                      {order.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">
                    {order.createdAt ? format(new Date(order.createdAt), 'MMM d, yyyy') : '—'}
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

export function SellerAnalytics() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    paymentsAPI.dashboard()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const stats = data ? [
    { label: 'Total revenue',  value: `$${data.totalRevenue?.toLocaleString() || 0}`,  desc: 'Gross before fees', color: 'text-brand' },
    { label: 'Net earnings',   value: `$${data.netRevenue?.toLocaleString() || 0}`,    desc: 'After platform fees', color: 'text-green-600' },
    { label: 'Platform fees',  value: `$${data.totalFees?.toLocaleString() || 0}`,     desc: '5% per transaction', color: 'text-gray-500' },
    { label: 'Total orders',   value: data.orderCount || 0,                            desc: 'Completed sales', color: 'text-brand2' },
  ] : [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold mb-6">Analytics</h1>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-xs font-bold text-gray-700 mt-1">{s.label}</div>
                <div className="text-xs text-gray-400">{s.desc}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold mb-4">Revenue breakdown</h2>
            <div className="space-y-3">
              {[
                { label: 'Gross revenue',    val: data?.totalRevenue || 0, pct: 100 },
                { label: 'Platform fee (5%)', val: data?.totalFees || 0,   pct: 5   },
                { label: 'Net earnings',     val: data?.netRevenue || 0,   pct: data?.totalRevenue ? Math.round((data.netRevenue / data.totalRevenue) * 100) : 0 },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold">{row.label}</span>
                    <span className="font-bold text-brand">${row.val.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-amber-50 rounded-xl p-4 text-sm text-amber-700">
              <strong>Payout info:</strong> Earnings are transferred to your connected Stripe account within 2 business days of order completion. Connect Stripe in your account settings to receive payouts.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SellerOrders;
