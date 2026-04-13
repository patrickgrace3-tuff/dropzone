import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './context/authStore.js';

import Layout        from './components/common/Layout.jsx';
import SellerLayout  from './components/common/SellerLayout.jsx';

import HomePage          from './pages/HomePage.jsx';
import MarketplacePage   from './pages/MarketplacePage.jsx';
import ListingPage       from './pages/ListingPage.jsx';
import LiveShowsPage     from './pages/LiveShowsPage.jsx';
import LiveShowPage      from './pages/LiveShowPage.jsx';
import ProfilePage       from './pages/ProfilePage.jsx';
import LoginPage         from './pages/LoginPage.jsx';
import RegisterPage      from './pages/RegisterPage.jsx';

import SellerDashboard     from './pages/seller/SellerDashboard.jsx';
import SellerListings      from './pages/seller/SellerListings.jsx';
import SellerCreateListing from './pages/seller/SellerCreateListing.jsx';
import SellerShows         from './pages/seller/SellerShows.jsx';
import SellerCreateShow    from './pages/seller/SellerCreateShow.jsx';
import SellerShowStudio    from './pages/seller/SellerShowStudio.jsx';
import SellerOrders        from './pages/seller/SellerOrders.jsx';
import SellerAnalytics     from './pages/seller/SellerAnalytics.jsx';

function RequireAuth({ children }) {
  const user        = useAuthStore(s => s.user);
  const initialized = useAuthStore(s => s.initialized);

  // Still booting — but if we already have a cached user show content immediately
  if (!initialized && !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireSeller({ children }) {
  const user = useAuthStore(s => s.user);
  // If not a seller, send them to become-seller flow on the home page
  if (user && user.role !== 'seller' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  // Use a stable reference — only call init once on mount
  const init = useAuthStore(s => s.init);

  useEffect(() => {
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      {/* Public routes */}
      <Route element={<Layout />}>
        <Route path="/"                  element={<HomePage />} />
        <Route path="/marketplace"       element={<MarketplacePage />} />
        <Route path="/listing/:id"       element={<ListingPage />} />
        <Route path="/shows"             element={<LiveShowsPage />} />
        <Route path="/shows/:id"         element={<LiveShowPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/login"             element={<LoginPage />} />
        <Route path="/register"          element={<RegisterPage />} />
      </Route>

      {/* Seller dashboard — protected */}
      <Route path="/seller" element={
        <RequireAuth>
          <RequireSeller>
            <SellerLayout />
          </RequireSeller>
        </RequireAuth>
      }>
        <Route index                    element={<SellerDashboard />} />
        <Route path="listings"          element={<SellerListings />} />
        <Route path="listings/new"      element={<SellerCreateListing />} />
        <Route path="listings/:id/edit" element={<SellerCreateListing />} />
        <Route path="shows"             element={<SellerShows />} />
        <Route path="shows/new"         element={<SellerCreateShow />} />
        <Route path="shows/:id/studio"  element={<SellerShowStudio />} />
        <Route path="orders"            element={<SellerOrders />} />
        <Route path="analytics"         element={<SellerAnalytics />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
