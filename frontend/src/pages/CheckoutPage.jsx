import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listingsAPI, ordersAPI } from '../services/api.js';
import { useAuthStore } from '../context/authStore.js';
import toast from 'react-hot-toast';

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function CheckoutPage() {
  const { listingId } = useParams();
  const { user }      = useAuthStore();
  const navigate      = useNavigate();

  const [listing, setListing]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep]         = useState(1); // 1=shipping, 2=payment, 3=confirm

  const [shipping, setShipping] = useState({
    name: user?.displayName || user?.username || '',
    line1: '', line2: '', city: '', state: '', zip: '', country: 'US', phone: '',
  });

  const [payment, setPayment] = useState({
    method: 'card',
    cardNumber: '', cardExpiry: '', cardCvc: '', cardName: '',
  });

  useEffect(() => {
    listingsAPI.get(listingId)
      .then(({ listing: l }) => { setListing(l); setLoading(false); })
      .catch(() => { toast.error('Listing not found'); navigate('/'); });
  }, [listingId]);

  const setS = (k, v) => setShipping(s => ({ ...s, [k]: v }));
  const setP = (k, v) => setPayment(p => ({ ...p, [k]: v }));

  const validateShipping = () => {
    if (!shipping.name || !shipping.line1 || !shipping.city || !shipping.state || !shipping.zip)
      { toast.error('Please fill in all required shipping fields'); return false; }
    return true;
  };

  const validatePayment = () => {
    if (payment.method === 'card') {
      if (!payment.cardNumber || !payment.cardExpiry || !payment.cardCvc || !payment.cardName)
        { toast.error('Please fill in all card details'); return false; }
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    setSubmitting(true);
    try {
      const { order } = await ordersAPI.create({
        listingId,
        type: listing.type === 'buy_now' ? 'buy_now' : 'auction_win',
        shippingAddress: shipping,
      });
      // Mark as paid (simplified — no real payment processing yet)
      await ordersAPI.pay(order.id, { paymentMethod: payment.method });
      toast.success('🎉 Order placed! Check your orders for details.');
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error(err.error || 'Failed to place order');
    }
    setSubmitting(false);
  };

  const price    = listing?.type === 'buy_now' ? listing?.buyNow?.price : listing?.auction?.currentBid;
  const fee      = (price || 0) * 0.05;
  const shipping_cost = listing?.shipping?.freeShipping ? 0 : 9.99;
  const total    = (price || 0) + shipping_cost;

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Steps */}
        <div className="lg:col-span-2 space-y-4">

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-6">
            {['Shipping', 'Payment', 'Review'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <button onClick={() => { if (i + 1 < step) setStep(i + 1); }}
                  className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-all
                    ${step === i+1 ? 'bg-brand text-white' : step > i+1 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {step > i+1 ? '✓' : i+1}
                </button>
                <span className={`text-sm font-semibold ${step === i+1 ? 'text-brand2' : 'text-gray-400'}`}>{s}</span>
                {i < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>

          {/* Step 1: Shipping */}
          {step === 1 && (
            <div className="card p-6 space-y-4">
              <h2 className="font-bold text-lg">Shipping address</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Full name *</label>
                  <input value={shipping.name} onChange={e => setS('name', e.target.value)} className="input" placeholder="John Smith" />
                </div>
                <div className="col-span-2">
                  <label className="label">Address line 1 *</label>
                  <input value={shipping.line1} onChange={e => setS('line1', e.target.value)} className="input" placeholder="123 Main St" />
                </div>
                <div className="col-span-2">
                  <label className="label">Address line 2</label>
                  <input value={shipping.line2} onChange={e => setS('line2', e.target.value)} className="input" placeholder="Apt, Suite, etc (optional)" />
                </div>
                <div>
                  <label className="label">City *</label>
                  <input value={shipping.city} onChange={e => setS('city', e.target.value)} className="input" placeholder="Nashville" />
                </div>
                <div>
                  <label className="label">State *</label>
                  <select value={shipping.state} onChange={e => setS('state', e.target.value)} className="input">
                    <option value="">Select state</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ZIP code *</label>
                  <input value={shipping.zip} onChange={e => setS('zip', e.target.value)} className="input" placeholder="37201" maxLength={10} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input value={shipping.phone} onChange={e => setS('phone', e.target.value)} className="input" placeholder="615-555-0100" />
                </div>
              </div>
              <button onClick={() => { if (validateShipping()) setStep(2); }}
                className="btn-primary w-full py-3 text-base mt-2">
                Continue to payment →
              </button>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 2 && (
            <div className="card p-6 space-y-4">
              <h2 className="font-bold text-lg">Payment method</h2>

              {/* Method selector */}
              <div className="flex gap-3">
                {[['card','💳 Credit / Debit card'],['paypal','🅿 PayPal']].map(([val, label]) => (
                  <button key={val} onClick={() => setP('method', val)}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all
                      ${payment.method === val ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {payment.method === 'card' && (
                <div className="space-y-4">
                  <div>
                    <label className="label">Cardholder name *</label>
                    <input value={payment.cardName} onChange={e => setP('cardName', e.target.value)}
                      className="input" placeholder="John Smith" />
                  </div>
                  <div>
                    <label className="label">Card number *</label>
                    <input value={payment.cardNumber}
                      onChange={e => setP('cardNumber', e.target.value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim())}
                      className="input font-mono" placeholder="1234 5678 9012 3456" maxLength={19} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Expiry date *</label>
                      <input value={payment.cardExpiry}
                        onChange={e => { let v = e.target.value.replace(/\D/g,''); if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2,4); setP('cardExpiry', v); }}
                        className="input font-mono" placeholder="MM/YY" maxLength={5} />
                    </div>
                    <div>
                      <label className="label">CVC *</label>
                      <input value={payment.cardCvc}
                        onChange={e => setP('cardCvc', e.target.value.replace(/\D/g,'').slice(0,4))}
                        className="input font-mono" placeholder="123" maxLength={4} />
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                    🔒 This is a demo — no real charges will be made. Integrate Stripe for live payments.
                  </div>
                </div>
              )}

              {payment.method === 'paypal' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center text-sm text-blue-700">
                  <p className="font-bold mb-1">🅿 PayPal</p>
                  <p>You'll be redirected to PayPal to complete payment.</p>
                  <p className="text-xs mt-1 opacity-70">Demo mode — no real redirect.</p>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">← Back</button>
                <button onClick={() => { if (validatePayment()) setStep(3); }} className="btn-primary flex-1 py-3">
                  Review order →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & confirm */}
          {step === 3 && (
            <div className="card p-6 space-y-5">
              <h2 className="font-bold text-lg">Review your order</h2>

              {/* Shipping summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm">Shipping to</h3>
                  <button onClick={() => setStep(1)} className="text-xs text-brand underline">Edit</button>
                </div>
                <p className="text-sm">{shipping.name}</p>
                <p className="text-sm text-gray-500">{shipping.line1}{shipping.line2 ? `, ${shipping.line2}` : ''}</p>
                <p className="text-sm text-gray-500">{shipping.city}, {shipping.state} {shipping.zip}</p>
                {shipping.phone && <p className="text-sm text-gray-500">{shipping.phone}</p>}
              </div>

              {/* Payment summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm">Payment</h3>
                  <button onClick={() => setStep(2)} className="text-xs text-brand underline">Edit</button>
                </div>
                {payment.method === 'card'
                  ? <p className="text-sm text-gray-500">💳 Card ending in {payment.cardNumber.replace(/\s/g,'').slice(-4) || '****'}</p>
                  : <p className="text-sm text-gray-500">🅿 PayPal</p>}
              </div>

              <button onClick={handlePlaceOrder} disabled={submitting}
                className="btn-primary w-full py-4 text-base disabled:opacity-60">
                {submitting ? 'Placing order...' : `Place order — $${total.toFixed(2)}`}
              </button>

              <p className="text-xs text-gray-400 text-center">
                By placing your order you agree to our Terms of Service.
              </p>
            </div>
          )}
        </div>

        {/* Right: Order summary */}
        <div className="space-y-4">
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
                <p className="font-bold text-sm line-clamp-2">{listing?.title}</p>
                <p className="text-xs text-gray-400 capitalize mt-0.5">{listing?.condition?.replace('_',' ')}</p>
                <p className="text-xs text-gray-400">Sold by {listing?.seller?.username}</p>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Item price</span>
                <span className="font-semibold">${(price || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shipping</span>
                <span className={`font-semibold ${shipping_cost === 0 ? 'text-green-600' : ''}`}>
                  {shipping_cost === 0 ? 'FREE' : `$${shipping_cost.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 font-extrabold text-base">
                <span>Total</span>
                <span className="text-brand">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 bg-green-50 rounded-xl p-3 text-xs text-green-700 flex items-start gap-2">
              <span>🔒</span>
              <span>Your payment info is secure and encrypted.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
