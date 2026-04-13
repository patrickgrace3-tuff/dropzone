import { create } from 'zustand';
import { authAPI } from '../services/api.js';
import { connectSocket, disconnectSocket } from '../services/socket.js';

function loadUser()       { try { return JSON.parse(localStorage.getItem('dz_user') || 'null'); } catch { return null; } }
function saveUser(user)   { if (user) localStorage.setItem('dz_user', JSON.stringify(user)); else localStorage.removeItem('dz_user'); }
function loadToken()      { return localStorage.getItem('dz_token') || null; }

export const useAuthStore = create((set, get) => ({
  user:        loadUser(),   // hydrate immediately — no flash on page load
  token:       loadToken(),
  loading:     false,
  initialized: !!loadToken() && !!loadUser(), // if both exist, consider already initialized

  init: async () => {
    // Prevent running more than once
    if (get().initialized) return;

    const token = loadToken();
    if (!token) {
      set({ user: null, token: null, initialized: true });
      return;
    }

    // If we have a cached user, mark initialized immediately so UI doesn't block
    const cached = loadUser();
    if (cached) {
      set({ user: cached, token, initialized: true });
      connectSocket();
    }

    // Silently verify & refresh user data from backend
    try {
      const { user } = await authAPI.me();
      saveUser(user);
      set({ user, initialized: true });
      connectSocket();
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 401) {
        // Token is invalid — log out
        localStorage.removeItem('dz_token');
        saveUser(null);
        set({ user: null, token: null, initialized: true });
      }
      // Any other error (network etc) — stay logged in with cached data
      set({ initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { token, user } = await authAPI.login({ email, password });
      localStorage.setItem('dz_token', token);
      saveUser(user);
      set({ user, token, loading: false, initialized: true });
      connectSocket();
      return { ok: true };
    } catch (err) {
      set({ loading: false });
      return { ok: false, error: err.error || 'Login failed' };
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      const { token, user } = await authAPI.register(data);
      localStorage.setItem('dz_token', token);
      saveUser(user);
      set({ user, token, loading: false, initialized: true });
      connectSocket();
      return { ok: true };
    } catch (err) {
      set({ loading: false });
      return { ok: false, error: err.error || 'Registration failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('dz_token');
    saveUser(null);
    disconnectSocket();
    set({ user: null, token: null, initialized: true });
  },

  updateUser: (updates) => {
    const user = { ...get().user, ...updates };
    saveUser(user);
    set({ user });
  },

  becomeSeller: async () => {
    const { user } = await authAPI.becomeSeller();
    saveUser(user);
    set({ user });
    return user;
  },

  isSeller: () => {
    const { user } = get();
    return user?.role === 'seller' || user?.role === 'admin';
  },
}));
