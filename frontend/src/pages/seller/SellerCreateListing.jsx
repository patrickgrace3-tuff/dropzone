import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { listingsAPI, aiAPI, uploadImage } from '../../services/api.js';
import { useAuthStore } from '../../context/authStore.js';
import toast from 'react-hot-toast';

const CATEGORIES = ['sneakers','cards','tech','vintage','streetwear','collectibles','jewelry','art','other'];
const CONDITIONS  = [
  { key: 'new',      label: 'New',       desc: 'Brand new, never used' },
  { key: 'like_new', label: 'Like New',  desc: 'Minimal to no signs of use' },
  { key: 'used',     label: 'Used',      desc: 'Normal signs of use' },
  { key: 'parts',    label: 'For Parts', desc: 'Not fully functional' },
];

export default function SellerCreateListing() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [form, setForm] = useState({
    title: '', description: '', category: 'sneakers', condition: 'new',
    type: 'auction', auctionType: 'standard', tags: '',
    auction: { startingBid: '', duration: 7, reservePrice: '' },
    buyNow:  { price: '', quantity: 1 },
    shipping: { freeShipping: false, weight: '' },
  });
  const [images, setImages]  = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]  = useState(false);

  // AI state
  const [aiPricing, setAiPricing]   = useState(null);
  const [aiLoading, setAiLoading]   = useState({ pricing: false, desc: false, script: false });
  const [aiDescPrompt, setAiDescPrompt] = useState('');

  const onDrop = useCallback(async (files) => {
    setUploading(true);
    for (const file of files.slice(0, 8)) {
      try {
        const { url, publicId } = await uploadImage(file);
        setImages(prev => [...prev, { url, publicId, preview: URL.createObjectURL(file) }]);
      } catch { toast.error('Upload failed'); }
    }
    setUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 8,
  });

  const set = (path, val) => {
    setForm(f => {
      const clone = { ...f };
      const keys  = path.split('.');
      let cur = clone;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] = { ...cur[keys[i]] };
      cur[keys[keys.length - 1]] = val;
      return clone;
    });
  };

  const getAiPricing = async () => {
    if (!form.title) { toast.error('Enter a title first'); return; }
    setAiLoading(l => ({ ...l, pricing: true }));
    try {
      const data = await aiAPI.pricing({ title: form.title, category: form.category, condition: form.condition });
      setAiPricing(data);
      if (data.start) set('auction.startingBid', data.start);
      if (data.buyNow) set('buyNow.price', data.buyNow);
      toast.success('AI pricing loaded!');
    } catch { toast.error('AI pricing failed'); }
    setAiLoading(l => ({ ...l, pricing: false }));
  };

  const getAiDescription = async () => {
    if (!aiDescPrompt && !form.title) { toast.error('Enter a description hint or title'); return; }
    setAiLoading(l => ({ ...l, desc: true }));
    try {
      const { description } = await aiAPI.description({ prompt: aiDescPrompt || form.title, title: form.title, category: form.category, condition: form.condition });
      set('description', description);
      toast.success('Description generated!');
    } catch { toast.error('AI description failed'); }
    setAiLoading(l => ({ ...l, desc: false }));
  };

  const handleSave = async (publish = false) => {
    if (!form.title || !form.description) { toast.error('Title and description are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        images: images.map(({ url, publicId }) => ({ url, publicId })),
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        auctionType: form.auctionType,
      };
      const { listing } = await listingsAPI.create(payload);
      if (publish) {
        await listingsAPI.publish(listing.id);
        toast.success('🎉 Listing is live!');
      } else {
        toast.success('Saved as draft');
      }
      navigate('/seller/listings');
    } catch (err) {
      toast.error(err.error || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-extrabold">Create listing</h1>
        <div className="flex gap-2">
          <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary">Save draft</button>
          <button onClick={() => handleSave(true)}  disabled={saving} className="btn-primary">Publish listing</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main form */}
        <div className="lg:col-span-2 space-y-5">

          {/* Photos */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-bold mb-3">Photos</h2>
            <div {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${isDragActive ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand'}`}>
              <input {...getInputProps()} />
              <div className="text-3xl mb-2">{uploading ? '⏳' : '📸'}</div>
              <p className="text-sm font-semibold text-gray-600">{uploading ? 'Uploading...' : 'Drag photos here or click to upload'}</p>
              <p className="text-xs text-gray-400 mt-1">Up to 8 photos · JPG, PNG, WebP</p>
            </div>
            {images.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                    <img src={img.preview || img.url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white rounded-full text-[10px] flex items-center justify-center">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Item details */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-bold">Item details</h2>

            <div>
              <label className="label">Title</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                className="input" placeholder="e.g. Air Jordan 1 Retro OG Chicago, Size 10" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
                  {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Condition</label>
                <select value={form.condition} onChange={e => set('condition', e.target.value)} className="input">
                  {CONDITIONS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                className="input resize-none" rows={5} placeholder="Describe your item in detail..." />
            </div>

            <div>
              <label className="label">Tags (comma-separated)</label>
              <input value={form.tags} onChange={e => set('tags', e.target.value)}
                className="input" placeholder="jordan, sneakers, chicago, size 10" />
            </div>
          </div>

          {/* Listing type */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-bold">Listing type</h2>

            {/* Auction type — standard vs live show only */}
            <div>
              <label className="label">Where can this be sold?</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => set('auctionType', 'standard')}
                  className={`p-4 rounded-xl border-2 text-left transition-all
                    ${form.auctionType === 'standard'
                      ? 'border-brand bg-brand/5'
                      : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-xl mb-1">🛍</div>
                  <div className="font-bold text-sm">Marketplace auction</div>
                  <div className="text-xs text-gray-500 mt-0.5">Listed publicly, anyone can bid anytime</div>
                </button>
                <button type="button"
                  onClick={() => set('auctionType', 'live_show')}
                  className={`p-4 rounded-xl border-2 text-left transition-all
                    ${form.auctionType === 'live_show'
                      ? 'border-live bg-live/5'
                      : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-xl mb-1">🎬</div>
                  <div className="font-bold text-sm">Live show only</div>
                  <div className="text-xs text-gray-500 mt-0.5">Hidden from marketplace, only available during your live show</div>
                </button>
              </div>
              {form.auctionType === 'live_show' && (
                <div className="mt-2 bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-700 flex gap-2">
                  <span>🎬</span>
                  <span>This item will be hidden from the marketplace. Add it to a live show from your Show Studio to sell it.</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {[['auction','Auction 🔨'],['buy_now','Buy Now 🛍'],['both','Both']].map(([v, l]) => (
                <button key={v} onClick={() => set('type', v)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all
                    ${form.type === v ? 'bg-brand text-white border-brand' : 'bg-white text-gray-500 border-gray-200 hover:border-brand'}`}>
                  {l}
                </button>
              ))}
            </div>

            {(form.type === 'auction' || form.type === 'both') && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Starting bid ($)</label>
                  <input type="number" value={form.auction.startingBid} onChange={e => set('auction.startingBid', e.target.value)} className="input" min="0" />
                </div>
                <div>
                  <label className="label">Reserve price ($)</label>
                  <input type="number" value={form.auction.reservePrice} onChange={e => set('auction.reservePrice', e.target.value)} className="input" min="0" placeholder="Optional" />
                </div>
                <div>
                  <label className="label">Duration (days)</label>
                  <select value={form.auction.duration} onChange={e => set('auction.duration', Number(e.target.value))} className="input">
                    {[1,3,5,7,10,14].map(d => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
              </div>
            )}

            {(form.type === 'buy_now' || form.type === 'both') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Buy Now price ($)</label>
                  <input type="number" value={form.buyNow.price} onChange={e => set('buyNow.price', e.target.value)} className="input" min="0" />
                </div>
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" value={form.buyNow.quantity} onChange={e => set('buyNow.quantity', e.target.value)} className="input" min="1" />
                </div>
              </div>
            )}
          </div>

          {/* Shipping */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h2 className="font-bold">Shipping</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.shipping.freeShipping}
                onChange={e => set('shipping.freeShipping', e.target.checked)} className="w-4 h-4 accent-brand" />
              <span className="text-sm font-semibold">Offer free shipping</span>
            </label>
            <div>
              <label className="label">Item weight (lbs)</label>
              <input type="number" value={form.shipping.weight} onChange={e => set('shipping.weight', e.target.value)}
                className="input w-40" min="0" step="0.1" placeholder="0.5" />
            </div>
          </div>
        </div>

        {/* Right: AI panel */}
        <div className="space-y-4">
          {/* AI Pricing */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-full">✦ AI</span>
              <h3 className="font-bold text-sm">Smart pricing</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">Get AI-powered price suggestions based on market data.</p>
            <button onClick={getAiPricing} disabled={aiLoading.pricing}
              className="w-full py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-all disabled:opacity-60">
              {aiLoading.pricing ? '✦ Analyzing...' : '✦ Analyze pricing'}
            </button>
            {aiPricing && (
              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Start bid', val: `$${aiPricing.start}` },
                    { label: 'Fair value', val: `$${aiPricing.fair}` },
                    { label: 'Buy Now',   val: `$${aiPricing.buyNow}` },
                  ].map(p => (
                    <div key={p.label} className="bg-violet-50 rounded-xl p-2 text-center">
                      <div className="text-[10px] text-violet-500 font-bold uppercase">{p.label}</div>
                      <div className="text-base font-extrabold text-violet-900">{p.val}</div>
                    </div>
                  ))}
                </div>
                {aiPricing.note && (
                  <p className="text-xs text-violet-600 bg-violet-50 rounded-xl p-2">✦ {aiPricing.note}</p>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">Confidence:</span>
                  <span className={`text-[10px] font-bold capitalize
                    ${aiPricing.confidence === 'high' ? 'text-green-600'
                    : aiPricing.confidence === 'medium' ? 'text-amber-600'
                    : 'text-gray-400'}`}>{aiPricing.confidence}</span>
                </div>
              </div>
            )}
          </div>

          {/* AI Description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-bold rounded-full">✦ AI</span>
              <h3 className="font-bold text-sm">Write description</h3>
            </div>
            <textarea value={aiDescPrompt} onChange={e => setAiDescPrompt(e.target.value)}
              className="input resize-none text-xs mb-2" rows={3}
              placeholder="Tell AI about the item: condition details, accessories, notable features..." />
            <button onClick={getAiDescription} disabled={aiLoading.desc}
              className="w-full py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-all disabled:opacity-60">
              {aiLoading.desc ? '✦ Writing...' : '✦ Generate description'}
            </button>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
            <h3 className="font-bold text-sm text-amber-800 mb-2">💡 Listing tips</h3>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• Use 5–8 clear photos from different angles</li>
              <li>• Include measurements and any defects</li>
              <li>• Set a competitive starting bid to attract early bids</li>
              <li>• End auctions on Sunday evenings for best results</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
