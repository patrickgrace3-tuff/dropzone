import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ordersAPI } from '../services/api.js';
import { useAuthStore } from '../context/authStore.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_STEPS = ['pending_payment','paid','processing','shipped','delivered'];
const STATUS_LABELS = {
  pending_payment: 'Awaiting Payment',
  paid:            'Payment Received',
  processing:      'Processing',
  shipped:         'Shipped',
  delivered:       'Delivered',
};
const STATUS_COLORS = {
  pending_payment: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid:            'bg-blue-50 text-blue-700 border-blue-200',
  processing:      'bg-purple-50 text-purple-700 border-purple-200',
  shipped:         'bg-indigo-50 text-indigo-700 border-indigo-200',
  delivered:       'bg-green-50 text-green-700 border-green-200',
};

export default function OrderDetailPage() {
  const { id }   = useParams();
  const navigate  = useNavigate();
  const { user } = useAuthStore();
  const [order, setOrder]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [shipping, setShipping]   = useState({ trackingNumber: '', carrier: 'USPS' });
  const [review, setReview]       = useState({ rating: 5, comment: '' });
  const [showShipForm, setShowShipForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => ordersAPI.get(id)
    .then(({ order: o }) => { setOrder(o); setLoading(false); })
    .catch(() => setLoading(false));

  useEffect(() => { load(); }, [id]);

  const handleShip = async () => {
    if (!shipping.trackingNumber) { toast.error('Enter a tracking number'); return; }
    setSubmitting(true);
    try {
      await ordersAPI.ship(id, shipping);
      toast.success('📦 Order marked as shipped!');
      setShowShipForm(false);
      load();
    } catch { toast.error('Failed'); }
    setSubmitting(false);
  };

  const handleReview = async () => {
    setSubmitting(true);
    try {
      await ordersAPI.review(id, review);
      toast.success('⭐ Review submitted!');
      setShowReviewForm(false);
      load();
    } catch { toast.error('Failed'); }
    setSubmitting(false);
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this order?')) return;
    setSubmitting(true);
    try {
      await ordersAPI.cancel(id);
      toast.success('Order cancelled');
      load();
    } catch (err) { toast.error(err.error || 'Failed'); }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirm('Remove this order permanently?')) return;
    try {
      await ordersAPI.remove(id);
      toast.success('Order removed');
      navigate('/orders');
    } catch (err) { toast.error(err.error || 'Failed'); }
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-12 text-gray-400">Loading...</div>;
  if (!order)  return <div className="max-w-3xl mx-auto px-4 py-12 text-gray-400">Order not found</div>;

  const isBuyer  = order.buyer_id  === user?.id;
  const isSeller = order.seller_id === user?.id;
  const addr     = order.shippingAddr || order.shipping_addr || {};
  const stepIdx  = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={isSeller ? '/seller/orders' : '/orders'} className="text-sm text-gray-400 hover:text-brand mb-1 block">← Back to orders</Link>
          <h1 className="text-2xl font-extrabold">Order #{order.id.slice(0,8).toUpperCase()}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy h:mm a') : ''}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-bold border ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-500'}`}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-1 mb-4">
          {STATUS_STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all
                ${i <= stepIdx ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400'}`}>
                {i < stepIdx ? '✓' : i+1}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-1 rounded-full transition-all ${i < stepIdx ? 'bg-brand' : 'bg-gray-100'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          {STATUS_STEPS.map(s => <span key={s} className="text-center" style={{flex:1}}>{STATUS_LABELS[s]}</span>)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Item */}
        <div className="card p-5">
          <h3 className="font-bold mb-3">Item</h3>
          <div className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl">
              {order.listing?.images?.[0]?.url
                ? <img src={order.listing.images[0].url} className="w-full h-full object-cover" alt="" />
                : '📦'}
            </div>
            <div>
              <p className="font-bold text-sm">{order.listing?.title}</p>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{order.listing?.category}</p>
              <p className="text-lg font-extrabold text-brand mt-1">${order.amount?.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="card p-5">
          <h3 className="font-bold mb-3">Payment</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Item</span><span>${order.amount?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Platform fee</span><span>${order.platform_fee?.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
              <span>Total</span><span className="text-brand">${order.total?.toFixed(2)}</span>
            </div>
          </div>
          <div className={`mt-3 px-3 py-1.5 rounded-full text-xs font-bold inline-block border ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </div>
        </div>

        {/* Shipping address */}
        <div className="card p-5">
          <h3 className="font-bold mb-3">Ship to</h3>
          {addr?.name ? (
            <div className="text-sm space-y-0.5">
              <p className="font-semibold">{addr.name}</p>
              <p className="text-gray-500">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
              <p className="text-gray-500">{addr.city}, {addr.state} {addr.zip}</p>
              <p className="text-gray-500">{addr.country}</p>
              {addr.phone && <p className="text-gray-500">{addr.phone}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No shipping address provided yet</p>
          )}
        </div>

        {/* Tracking */}
        <div className="card p-5">
          <h3 className="font-bold mb-3">Tracking</h3>
          {order.tracking_number ? (
            <div className="text-sm space-y-1">
              <p><span className="text-gray-500">Carrier:</span> <strong>{order.carrier}</strong></p>
              <p><span className="text-gray-500">Tracking #:</span></p>
              <p className="font-mono font-bold text-brand bg-brand/5 px-3 py-2 rounded-lg">{order.tracking_number}</p>
              {order.shipped_at && <p className="text-xs text-gray-400">Shipped {format(new Date(order.shipped_at), 'MMM d, yyyy')}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not yet shipped</p>
          )}
        </div>
      </div>

      {/* Seller & buyer info */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{isBuyer ? 'Seller' : 'Buyer'}</p>
            <p className="font-bold">{isBuyer ? (order.seller?.displayName || order.seller?.username) : (order.buyer?.displayName || order.buyer?.username)}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isBuyer ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
            {isBuyer ? '🛍 You bought this' : '📦 You sold this'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">

        {/* Seller: mark as shipped */}
        {isSeller && order.status === 'paid' && (
          <div className="card p-5">
            <h3 className="font-bold mb-3">Mark as shipped</h3>
            {!showShipForm ? (
              <button onClick={() => setShowShipForm(true)} className="btn-primary">📦 Add tracking info</button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Carrier</label>
                    <select value={shipping.carrier} onChange={e => setShipping(s => ({...s, carrier: e.target.value}))} className="input">
                      {['USPS','UPS','FedEx','DHL','Other'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Tracking number</label>
                    <input value={shipping.trackingNumber} onChange={e => setShipping(s => ({...s, trackingNumber: e.target.value}))}
                      className="input font-mono" placeholder="1Z999AA10123456784" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowShipForm(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleShip} disabled={submitting} className="btn-primary flex-1 disabled:opacity-60">
                    {submitting ? 'Saving...' : 'Mark as shipped'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Buyer: leave review */}
        {isBuyer && order.status === 'delivered' && !order.review_rating && (
          <div className="card p-5">
            <h3 className="font-bold mb-3">Leave a review</h3>
            {!showReviewForm ? (
              <button onClick={() => setShowReviewForm(true)} className="btn-secondary">⭐ Write a review</button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">Rating</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setReview(r => ({...r, rating: n}))}
                        className={`text-2xl transition-transform hover:scale-110 ${n <= review.rating ? '' : 'opacity-30'}`}>⭐</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Comment</label>
                  <textarea value={review.comment} onChange={e => setReview(r => ({...r, comment: e.target.value}))}
                    className="input resize-none" rows={3} placeholder="Tell others about your experience..." />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowReviewForm(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleReview} disabled={submitting} className="btn-primary flex-1 disabled:opacity-60">
                    {submitting ? 'Submitting...' : 'Submit review'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cancel / Delete */}
      {!['shipped','delivered','cancelled'].includes(order.status) && (
        <div className="card p-5 border-red-100">
          <h3 className="font-bold mb-3 text-red-600">Cancel order</h3>
          <p className="text-sm text-gray-500 mb-3">Cancelling will restore the listing to active status.</p>
          <button onClick={handleCancel} disabled={submitting}
            className="px-4 py-2 bg-red-50 text-red-600 font-bold text-sm rounded-xl border border-red-200 hover:bg-red-100 disabled:opacity-50">
            {submitting ? 'Cancelling...' : 'Cancel this order'}
          </button>
        </div>
      )}

      {order.status === 'cancelled' && (
        <div className="card p-5 border-gray-100">
          <h3 className="font-bold mb-3 text-gray-500">Remove order</h3>
          <p className="text-sm text-gray-400 mb-3">Remove this cancelled order from your order history.</p>
          <button onClick={handleDelete}
            className="px-4 py-2 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200">
            🗑 Remove from history
          </button>
        </div>
      )}

      {order.review_rating && (
          <div className="card p-5 bg-yellow-50 border-yellow-100">
            <h3 className="font-bold mb-2">Your review</h3>
            <div className="flex items-center gap-1 mb-1">
              {Array.from({length:5}).map((_,i) => <span key={i} className={i < order.review_rating ? '' : 'opacity-20'}>⭐</span>)}
            </div>
            {order.review_comment && <p className="text-sm text-gray-600 italic">"{order.review_comment}"</p>}
          </div>
        )}
      </div>
    </div>
  );
}
