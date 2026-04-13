import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { listingsAPI, ordersAPI } from '../services/api.js';
import { useAuthStore } from '../context/authStore.js';
import toast from 'react-hot-toast';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC',
  'ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function CheckoutPage() {
  const { listingId } = useParams();
  const { user }      = useAuthStore();
  const navigate      = useNavigate();

  const [listing, setListing]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep]           = useState(1); // 1=shipping 2=payment 3=review

  const [shipping, setShipping] = useState({
    name:    user?.displayName || user?.username || '',
    line1:   '',
    line2:   '',
    city:    '',
    state:   '',
    zip:     '',
    country: 'US',
    phone:   '',
  });

  const [payment, setPayment] = useState({
    method:     'card',
    cardNumber: '',
    cardExpiry: '',
    cardCvc:    '',
    cardName:   '',
  });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    listingsAPI.get(listingId)
      .then(({ listing: l }) => { setListing(l); setLoading(false); })
      .catch(() => { toast.error('Listing not found'); navigate('/marketplace'); });
  }, [listingId]);

  const setS = (k, v) => setShipping(s => ({ ...s, [k]: v }));
  const setP = (k, v) => setPayment(p => ({ ...p, [k]: v }));

  const validateShipping = () => {
    if (!shipping.name.trim())  { toast.error('Full name is required');    return false; }
    if (!shipping.line1.trim()) { toast.error('Address is required');      return false; }
    if (!shipping.city.trim())  { toast.error('City is required');         return false; }
    if (!shipping.state)        { toast.error('State is required');        return false; }
    if (!shipping.zip.trim())   { toast.error('ZIP code is required');     return false; }
    return true;
  };

  const validatePayment = () => {
    if (payment.method === 'card') {
      if (!payment.cardName.trim())   { toast.error('Cardholder name required'); return false; }
      if (payment.cardNumber.replace(/\s/g,'').length < 12) { toast.error('Valid card number required'); return false; }
      if (!payment.cardExpiry.includes('/'))                 { toast.error('Card expiry required (MM/YY)'); return false; }
      if (payment.cardCvc.length < 3)                        { toast.error('CVC required'); return false; }
    }
    return true;
  };

  // Single call — creates order AND marks paid, idempotent (safe to retry)
  const handlePlaceOrder = async () => {
    setSubmitting(true);
    try {
      const { order } = await ordersAPI.checkout({
        listingId,
        shippingAddress: shipping,
        paymentMethod:   payment.method,
      });
      toast.success('🎉 Order placed successfully!');
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error(err.error || 'Failed to place order — please try again');
      setSubmitting(false);
    }
  };

  const price         = listing?.type === 'buy_now' ? listing?.buyNow?.price : listing?.auction?.currentBid;
  const shippingCost  = listing?.shipping?.freeShipping ? 0 : 0; // free for now
  const total         = (price || 0) + shippingCost;

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-12 flex items-center justify-center gap-2 text-gray-400">
      <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      Loading...
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link to={`/listing/${listingId}`} className="text-sm text-gray-400 hover:text-brand mb-4 inline-block">
        ← Back to listing
      </Link>
      <h1 className="text-2xl font-extrabold mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left: steps ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Step pills */}
          <div className="flex items-center gap-2 mb-6">
            {['Shipping', 'Payment', 'Review'].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <button
                  onClick={() => { if (i + 1 < step) setStep(i + 1); }}
                  className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all
                    ${step === i+1 ? 'bg-brand text-white'
                    : step > i+1  ? 'bg-green-500 text-white cursor-pointer'
                    : 'bg-gray-100 text-gray-400'}`}>
                  {step > i+1 ? '✓' : i+1}
                </button>
                <span className={`text-sm font-semibold ${step === i+1 ? 'text-brand2' : 'text-gray-400'}`}>{label}</span>
                {i < 2 && <div className="w-8 h-px bg-gray-200" />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Shipping ── */}
          {step === 1 && (
            <div className="card p-6">
              <h2 className="font-bold text-lg mb-5">Shipping address</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Full name *</label>
                  <input value={shipping.name} onChange={e => setS('name', e.target.value)}
                    className="input" placeholder="John Smith" />
                </div>
                <div className="col-span-2">
                  <label className="label">Address *</label>
                  <input value={shipping.line1} onChange={e => setS('line1', e.target.value)}
                    className="input" placeholder="123 Main St" />
                </div>
                <div className="col-span-2">
                  <label className="label">Apartment, suite, etc.</label>
                  <input value={shipping.line2} onChange={e => setS('line2', e.target.value)}
                    className="input" placeholder="Apt 4B (optional)" />
                </div>
                <div>
                  <label className="label">City *</label>
                  <input value={shipping.city} onChange={e => setS('city', e.target.value)}
                    className="input" placeholder="Nashville" />
                </div>
                <div>
                  <label className="label">State *</label>
                  <select value={shipping.state} onChange={e => setS('state', e.target.value)} className="input">
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ZIP code *</label>
                  <input value={shipping.zip} onChange={e => setS('zip', e.target.value)}
                    className="input" placeholder="37201" maxLength={10} />
                </div>
                <div>
                  <label className="label">Phone (optional)</label>
                  <input value={shipping.phone} onChange={e => setS('phone', e.target.value)}
                    className="input" placeholder="615-555-0100" />
                </div>
              </div>
              <button onClick={() => { if (validateShipping()) setStep(2); }}
                className="btn-primary w-full py-3 text-base mt-5">
                Continue to payment →
              </button>
            </div>
          )}

          {/* ── Step 2: Payment ── */}
          {step === 2 && (
            <div className="card p-6">
              <h2 className="font-bold text-lg mb-5">Payment method</h2>

              <div className="flex gap-3 mb-5">
                {[['card','💳 Card'], ['paypal','🅿 PayPal']].map(([val, label]) => (
                  <button key={val} onClick={() => setP('method', val)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all
                      ${payment.method === val
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {payment.method === 'card' && (
                <div className="space-y-4">
                  <div>
                    <label className="label">Name on card *</label>
                    <input value={payment.cardName} onChange={e => setP('cardName', e.target.value)}
                      className="input" placeholder="John Smith" />
                  </div>
                  <div>
                    <label className="label">Card number *</label>
                    <input
                      value={payment.cardNumber}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g,'').slice(0,16);
                        setP('cardNumber', v.replace(/(.{4})/g,'$1 ').trim());
                      }}
                      className="input font-mono tracking-widest" placeholder="1234 5678 9012 3456" maxLength={19} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Expiry (MM/YY) *</label>
                      <input
                        value={payment.cardExpiry}
                        onChange={e => {
                          let v = e.target.value.replace(/\D/g,'');
                          if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2,4);
                          setP('cardExpiry', v);
                        }}
                        className="input font-mono" placeholder="MM/YY" maxLength={5} />
                    </div>
                    <div>
                      <label className="label">CVC *</label>
                      <input
                        value={payment.cardCvc}
                        onChange={e => setP('cardCvc', e.target.value.replace(/\D/g,'').slice(0,4))}
                        className="input font-mono" placeholder="123" maxLength={4} />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <span>This is a demo marketplace. No real charges will be made. To enable live payments, connect Stripe in your backend.</span>
                  </div>
                </div>
              )}

              {payment.method === 'paypal' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center text-blue-700">
                  <p className="text-2xl mb-2">🅿</p>
                  <p className="font-bold">PayPal</p>
                  <p className="text-sm mt-1">You'll be redirected to PayPal to complete payment.</p>
                  <p className="text-xs mt-1 opacity-60">(Demo mode — no redirect)</p>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">← Back</button>
                <button onClick={() => { if (validatePayment()) setStep(3); }} className="btn-primary flex-1 py-3">
                  Review order →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review & confirm ── */}
          {step === 3 && (
            <div className="card p-6 space-y-5">
              <h2 className="font-bold text-lg">Review your order</h2>

              {/* Shipping */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">Shipping to</h3>
                  <button onClick={() => setStep(1)} className="text-xs text-brand font-semibold hover:underline">Edit</button>
                </div>
                <p className="text-sm font-semibold">{shipping.name}</p>
                <p className="text-sm text-gray-500">{shipping.line1}{shipping.line2 ? `, ${shipping.line2}` : ''}</p>
                <p className="text-sm text-gray-500">{shipping.city}, {shipping.state} {shipping.zip}</p>
                {shipping.phone && <p className="text-sm text-gray-500">{shipping.phone}</p>}
              </div>

              {/* Payment */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">Payment</h3>
                  <button onClick={() => setStep(2)} className="text-xs text-brand font-semibold hover:underline">Edit</button>
                </div>
                {payment.method === 'card'
                  ? <p className="text-sm text-gray-500">💳 Card ending in <strong>{payment.cardNumber.replace(/\s/g,'').slice(-4) || '????'}</strong></p>
                  : <p className="text-sm text-gray-500">🅿 PayPal</p>}
              </div>

              {/* Place order button */}
              <button
                onClick={handlePlaceOrder}
                disabled={submitting}
                className="btn-primary w-full py-4 text-base font-extrabold disabled:opacity-60">
                {submitting
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Placing order...
                    </span>
                  : `✓ Place order — $${total.toFixed(2)}`}
              </button>

              <p className="text-xs text-gray-400 text-center">
                By placing your order you agree to our <a href="/terms" className="underline">Terms of Service</a>.
              </p>
            </div>
          )}
        </div>

        {/* ── Right: order summary ── */}
        <div>
          <div className="card p-5 sticky top-20">
            <h3 className="font-bold mb-4">Order summary</h3>

            {/* Item */}
            <div className="flex gap-3 mb-4 pb-4 border-b border-gray-100">
              <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl">
                {listing?.images?.[0]?.url
                  ? <img src={listing.images[0].url} className="w-full h-full object-cover" alt="" />
                  : '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm line-clamp-2 leading-tight">{listing?.title}</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">{listing?.condition?.replace('_',' ')}</p>
                <p className="text-xs text-gray-400">by {listing?.seller?.username}</p>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Item price</span>
                <span className="font-semibold">${(price || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shipping</span>
                <span className="font-semibold text-green-600">FREE</span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-gray-100 font-extrabold text-base">
                <span>Total</span>
                <span className="text-brand">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 bg-green-50 rounded-xl p-3 text-xs text-green-700">
              <span>🔒</span>
              <span>Secure checkout. Your information is protected.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
