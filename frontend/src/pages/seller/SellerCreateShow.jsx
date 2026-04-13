import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showsAPI } from '../../services/api.js';
import toast from 'react-hot-toast';

export default function SellerCreateShow() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', scheduledAt: '', category: 'sneakers',
    chatEnabled: true, tags: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.scheduledAt) { toast.error('Title and date required'); return; }
    setSaving(true);
    try {
      const { show } = await showsAPI.create({
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      toast.success('Show created!');
      navigate(`/seller/shows/${show.id}/studio`);
    } catch (err) { toast.error(err.error || 'Failed'); }
    setSaving(false);
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-extrabold mb-6">Create Live Show</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <label className="label">Show title</label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            className="input" placeholder="e.g. Sunday Sneaker Drop — Jordan 1s & Dunks" />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            className="input resize-none" rows={3} placeholder="Tell viewers what to expect..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Scheduled date & time</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
              {['sneakers','cards','tech','vintage','streetwear','collectibles','other'].map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Tags (comma-separated)</label>
          <input value={form.tags} onChange={e => set('tags', e.target.value)}
            className="input" placeholder="jordan, sneakers, live auction" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.chatEnabled} onChange={e => set('chatEnabled', e.target.checked)}
            className="w-4 h-4 accent-brand" />
          <span className="text-sm font-semibold">Enable live chat</span>
        </label>

        <div className="pt-2 flex gap-3">
          <button onClick={() => navigate('/seller/shows')} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
            {saving ? 'Creating...' : 'Create show →'}
          </button>
        </div>
      </div>
    </div>
  );
}
