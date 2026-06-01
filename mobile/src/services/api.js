import axios from 'axios';
import { getToken } from './auth';

// ── Change this to your Cloudflare tunnel URL when testing on a real device ──
// localhost only works when the app runs in the same machine (Expo web).
// For Android/iOS device or emulator use your tunnel URL e.g.:
// export const BASE_URL = 'https://trace-blocks-5zdg.onrender.com';
export const BASE_URL = 'http://10.157.13.31:8000'; // ← replace with your machine's LAN IP

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token to every request automatically
client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export const apiLogin = (email, password) =>
  client.post('/api/mobile/login/', { email, password });

// ── Products ──────────────────────────────────────────────────────────────────

export const apiGetProducts = () =>
  client.get('/api/mobile/products/');

// ── Events ────────────────────────────────────────────────────────────────────

export const apiGetEvents = (sku) =>
  client.get(`/api/mobile/events/${sku}/`);

export const apiLogEvent = (sku, status, location, latitude, longitude, notes = '') =>
  client.post('/api/mobile/log/', {
    sku,
    status,
    location,
    latitude,
    longitude,
    notes,
  });

// ── QR ───────────────────────────────────────────────────────────────────────

export const apiResolveQR = (qrToken) =>
  client.get(`/api/mobile/qr/${qrToken}/`);