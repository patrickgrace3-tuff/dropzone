import { io } from 'socket.io-client';

let socket = null;

// In production connect to the Render backend URL, in dev use same host (proxied)
const SOCKET_URL = import.meta.env.VITE_API_URL || '/';

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth:              { token: localStorage.getItem('dz_token') || '' },
      autoConnect:       true,
      reconnection:      true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socket.on('connect',       () => console.log('Socket connected:', socket.id));
    socket.on('disconnect',    (r) => console.log('Socket disconnected:', r));
    socket.on('connect_error', (e) => console.warn('Socket error:', e.message));
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: localStorage.getItem('dz_token') || '' };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

function emit(event, data) {
  const s = getSocket();
  if (s.connected) { s.emit(event, data); }
  else { s.once('connect', () => s.emit(event, data)); }
}

export function joinListing(id)  { emit('join:listing', id); }
export function leaveListing(id) { emit('leave:listing', id); }
export function joinShow(id)     { emit('join:show', id); }
export function leaveShow(id)    { emit('leave:show', id); }
export function sendChat(showId, message)               { emit('show:chat',   { showId, message }); }
export function placeLiveBid(showId, listingId, amount) { emit('show:bid',    { showId, listingId, amount }); }
export function hammerSold(showId, listingId, wId, fp)  { emit('show:hammer', { showId, listingId, winnerId: wId, finalPrice: fp }); }
