import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../context/authStore.js';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Layout() {
  const { user, logout, becomeSeller } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [upgrading, setUpgrading]     = useState(false);

  const isSeller = user?.role === 'seller' || user?.role === 'admin';

  const navLinks = [
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/shows',       label: 'Live Shows'  },
  ];

  const handleBecomeSeller = async () => {
    setUpgrading(true);
    setMenuOpen(false);
    try {
      await becomeSeller();
      toast.success('🎉 You are now a seller! Redirecting to dashboard...');
      setTimeout(() => navigate('/seller'), 800);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setUpgrading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          {/* Logo */}
          <Link to="/" className="font-extrabold text-xl tracking-tight flex-shrink-0">
            drop<span className="text-brand">zone</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all
                  ${location.pathname.startsWith(l.to)
                    ? 'bg-brand text-white'
                    : 'text-gray-600 hover:text-brand2 hover:bg-gray-100'}`}>
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Live pill */}
            <Link to="/shows?status=live"
              className="hidden sm:flex items-center gap-1.5 bg-live text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse-fast" />
              LIVE
            </Link>

            {user ? (
              <>
                {/* Dashboard button — visible once seller */}
                {isSeller && (
                  <Link to="/seller"
                    className="btn-secondary hidden sm:inline-flex">
                    Dashboard
                  </Link>
                )}

                {/* Avatar dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    className="w-9 h-9 rounded-full bg-brand text-white font-bold text-sm flex items-center justify-center">
                    {(user.displayName || user.username)?.[0]?.toUpperCase()}
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 w-52 z-50">
                      <div className="px-4 py-2 border-b border-gray-100 mb-1">
                        <p className="text-sm font-bold">{user.displayName || user.username}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                      <Link to={`/profile/${user.username}`}
                        className="block px-4 py-2 text-sm hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}>
                        My Profile
                      </Link>
                      <Link to="/orders"
                        className="block px-4 py-2 text-sm hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}>
                        My Orders
                      </Link>
                      {isSeller ? (
                        <Link to="/seller"
                          className="block px-4 py-2 text-sm hover:bg-gray-50 font-semibold text-brand"
                          onClick={() => setMenuOpen(false)}>
                          Seller Dashboard →
                        </Link>
                      ) : (
                        <button
                          onClick={handleBecomeSeller}
                          disabled={upgrading}
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-brand font-semibold disabled:opacity-50">
                          {upgrading ? 'Upgrading...' : '⚡ Become a Seller'}
                        </button>
                      )}
                      <hr className="my-1 border-gray-100" />
                      <button
                        onClick={() => { logout(); setMenuOpen(false); navigate('/'); }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login"    className="btn-ghost hidden sm:inline-flex">Sign in</Link>
                <Link to="/register" className="btn-primary">Join free</Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button className="md:hidden p-2 text-gray-600" onClick={() => setMenuOpen(o => !o)}>
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Nav dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 flex flex-col gap-2">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to} className="py-2 font-semibold text-sm"
                onClick={() => setMenuOpen(false)}>{l.label}</Link>
            ))}
            {user ? (
              <>
                {isSeller ? (
                  <Link to="/seller" className="py-2 font-semibold text-sm text-brand"
                    onClick={() => setMenuOpen(false)}>Seller Dashboard →</Link>
                ) : (
                  <button onClick={handleBecomeSeller} disabled={upgrading}
                    className="py-2 font-semibold text-sm text-brand text-left disabled:opacity-50">
                    {upgrading ? 'Upgrading...' : '⚡ Become a Seller'}
                  </button>
                )}
                <button onClick={() => { logout(); setMenuOpen(false); navigate('/'); }}
                  className="py-2 font-semibold text-sm text-gray-400 text-left">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login"    className="py-2 font-semibold text-sm" onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link to="/register" className="py-2 font-semibold text-sm text-brand" onClick={() => setMenuOpen(false)}>Join free</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main><Outlet /></main>

      <footer className="mt-24 border-t border-gray-100 bg-white py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6 text-sm text-gray-400">
          <div className="font-extrabold text-brand2 text-lg">drop<span className="text-brand">zone</span></div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-brand2">Help</a>
            <a href="#" className="hover:text-brand2">Fees</a>
            <a href="#" className="hover:text-brand2">Privacy</a>
            <a href="#" className="hover:text-brand2">Terms</a>
          </div>
          <div>© {new Date().getFullYear()} Dropzone. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
