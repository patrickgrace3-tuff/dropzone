import axios from 'axios';

// In production VITE_API_URL points to the Render backend URL
// In dev, Vite proxies /api to localhost:3001
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL: BASE, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dz_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || err)
);

export default api;

export const authAPI = {
  register:     (data) => api.post('/auth/register', data),
  login:        (data) => api.post('/auth/login', data),
  me:           ()     => api.get('/auth/me'),
  becomeSeller: ()     => api.post('/auth/become-seller'),
};

export const listingsAPI = {
  browse:   (params) => api.get('/listings', { params }),
  get:      (id)     => api.get(`/listings/${id}`),
  create:   (data)   => api.post('/listings', data),
  update:   (id, d)  => api.put(`/listings/${id}`, d),
  publish:  (id)     => api.post(`/listings/${id}/publish`),
  remove:   (id)     => api.delete(`/listings/${id}`),
  bySeller: (id, p)  => api.get(`/listings/seller/${id}`, { params: p }),
};

export const bidsAPI = {
  place:      (listingId, amount) => api.post(`/bids/${listingId}`, { amount }),
  forListing: (listingId)         => api.get(`/bids/listing/${listingId}`),
  myHistory:  ()                  => api.get('/bids/my/history'),
};

export const showsAPI = {
  list:     (params) => api.get('/shows', { params }),
  get:      (id)     => api.get(`/shows/${id}`),
  create:   (data)   => api.post('/shows', data),
  start:    (id)     => api.post(`/shows/${id}/start`),
  end:      (id)     => api.post(`/shows/${id}/end`),
  addItem:  (id, d)  => api.post(`/shows/${id}/inventory`, d),
  nextItem: (id)     => api.post(`/shows/${id}/next-item`),
  hammer:   (id, d)  => api.post(`/shows/${id}/hammer`, d),
};

export const usersAPI = {
  profile:  (username) => api.get(`/users/${username}`),
  updateMe: (data)     => api.put('/users/me/profile', data),
  myOrders: ()         => api.get('/users/me/orders'),
  mySales:  ()         => api.get('/users/me/sales'),
};

export const paymentsAPI = {
  buyNow:    (listingId) => api.post(`/payments/buy-now/${listingId}`),
  dashboard: ()          => api.get('/payments/dashboard'),
};

export const aiAPI = {
  pricing:    (data) => api.post('/ai/pricing', data),
  description:(data) => api.post('/ai/description', data),
  showScript: (data) => api.post('/ai/show-script', data),
};

export const ordersAPI = {
  my:       ()         => api.get('/orders/my'),
  sales:    ()         => api.get('/orders/sales'),
  get:      (id)       => api.get(`/orders/${id}`),
  checkout: (data)     => api.post('/orders/checkout', data),  // single-step: create + pay
  ship:     (id, data) => api.put(`/orders/${id}/ship`, data),
  deliver:  (id)       => api.put(`/orders/${id}/deliver`),
  review:   (id, data) => api.post(`/orders/${id}/review`, data),
};

export const uploadImage = async (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
