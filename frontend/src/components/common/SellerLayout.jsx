import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../context/authStore.js';

const navItems = [
  { to: '/seller',           label: 'Dashboard',  icon: '📊', end: true },
  { to: '/seller/listings',  label: 'Listings',   icon: '📦' },
  { to: '/seller/shows',     label: 'Live Shows', icon: '🎬' },
  { to: '/seller/orders',    label: 'Orders',     icon: '🛒' },
  { to: '/seller/analytics', label: 'Analytics',  icon: '📈' },
];

export default function SellerLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-[#F8F7F4]">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-brand2 text-white flex flex-col min-h-screen">
        <div className="p-5 border-b border-white/10">
          <div className="font-extrabold text-lg">drop<span className="text-brand">zone</span></div>
          <div className="text-xs text-white/50 mt-0.5">Seller Studio</div>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`
              }>
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center font-bold text-sm flex-shrink-0">
              {(user?.displayName || user?.username)?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user?.displayName || user?.username}</div>
              <div className="text-xs text-white/40">Seller</div>
            </div>
          </div>

          {/* Back to marketplace — just navigates, does NOT log out */}
          <Link to="/"
            className="block w-full text-left text-xs text-white/40 hover:text-white/70 transition-colors">
            ← Back to marketplace
          </Link>

          {/* Separate sign out button */}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="block w-full text-left text-xs text-red-400/60 hover:text-red-400 transition-colors">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
