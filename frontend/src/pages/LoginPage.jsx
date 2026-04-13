import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore.js';
import toast from 'react-hot-toast';

export function LoginPage() {
  const [form, setForm]   = useState({ email: '', password: '' });
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    const result = await login(form.email, form.password);
    if (result.ok) { toast.success('Welcome back!'); navigate('/'); }
    else toast.error(result.error);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold mb-1">drop<span className="text-brand">zone</span></div>
          <p className="text-gray-500 text-sm">Sign in to your account</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required className="input"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-center text-sm text-gray-500">
            No account? <Link to="/register" className="text-brand font-semibold hover:underline">Join free</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [form, setForm]     = useState({ username: '', email: '', password: '', displayName: '' });
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    const result = await register(form);
    if (result.ok) { toast.success('Account created! Welcome to Dropzone 🎉'); navigate('/'); }
    else toast.error(result.error);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-extrabold mb-1">drop<span className="text-brand">zone</span></div>
          <p className="text-gray-500 text-sm">Create your free account</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Display name</label>
            <input type="text" className="input" placeholder="Your name"
              value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
          </div>
          <div>
            <label className="label">Username</label>
            <input type="text" required className="input" placeholder="sneakervault"
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required minLength={8} className="input"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base disabled:opacity-60">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Have an account? <Link to="/login" className="text-brand font-semibold hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
