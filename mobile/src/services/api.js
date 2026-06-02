import axios from 'axios';
import { getToken } from './auth';

// ── Change to your LAN IP for local testing, or your Render URL for production
export const BASE_URL = 'http://10.157.13.31:8000';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token to every request automatically
client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const apiLogin          = (email, password) =>
  client.post('/api/mobile/login/', { email, password });

export const apiGetProfile     = () =>
  client.get('/api/mobile/auth/profile/');

export const apiUpdateProfile  = (data) =>
  client.patch('/api/mobile/auth/update-profile/', data);

export const apiChangePassword = (current_password, new_password) =>
  client.post('/api/mobile/auth/change-password/', { current_password, new_password });

export const apiLogoutAll      = () =>
  client.delete('/api/mobile/auth/sessions/');

// ── Products ──────────────────────────────────────────────────────────────────
export const apiGetProducts    = () =>
  client.get('/api/mobile/products/');

export const apiCreateProduct  = (data) =>
  client.post('/api/mobile/products/create/', data);

// ── Events ────────────────────────────────────────────────────────────────────
export const apiGetEvents      = (sku) =>
  client.get(`/api/mobile/events/${sku}/`);

export const apiLogEvent       = (sku, status, location, latitude, longitude, notes = '') =>
  client.post('/api/mobile/log/', { sku, status, location, latitude, longitude, notes });

export const apiLogHandover    = (data) =>
  client.post('/api/mobile/handover/', data);

// ── QR ────────────────────────────────────────────────────────────────────────
export const apiResolveQR      = (qrToken) =>
  client.get(`/api/mobile/qr/${qrToken}/`);