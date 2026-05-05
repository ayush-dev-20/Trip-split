import axios from 'axios';
import { getClerkToken } from '@/lib/clerkHelper';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach Clerk session token to every request
api.interceptors.request.use(async (config) => {
  const token = await getClerkToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, Clerk handles session refresh automatically via its SDK.
// We just propagate the error so the caller (or ClerkProvider) can react.
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
