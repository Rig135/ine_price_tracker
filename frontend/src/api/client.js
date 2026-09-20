// Resolve and normalize backend API Base URL
let rawBase = import.meta.env.VITE_API_URL || '';
if (!rawBase) {
  // If not configured in production Vercel deployment
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.warn('[INE Tracker] VITE_API_URL is not set in Vercel environment variables. Falling back to localhost.');
  }
  rawBase = 'http://localhost:5001/api';
}

// Ensure clean format with /api path and no trailing slash
let cleanBase = rawBase.replace(/\/+$/, '');
if (!cleanBase.endsWith('/api') && !cleanBase.includes('/api/')) {
  cleanBase = `${cleanBase}/api`;
}

export const API_BASE_URL = cleanBase;

/**
 * Fetch wrapper for making API calls to the backend
 */
export async function fetchApi(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http:')) {
        throw new Error('Connection blocked: App is on HTTPS but VITE_API_URL is configured as HTTP. Please set VITE_API_URL with your secure https:// URL in Vercel.');
      }
      if (url.includes('localhost') && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        throw new Error('Backend URL not configured: VITE_API_URL is pointing to localhost on deployed app. Set VITE_API_URL in Vercel Project Settings > Environment Variables to your Render URL, then Redeploy.');
      }
      throw new Error(`Unable to reach backend at ${url}. If your Render service is waking from sleep (free tier), please wait ~30 seconds and retry.`);
    }
    throw err;
  }
}

export const api = {
  getHealth: () => fetchApi('/health'),
  
  // Search mock storefront catalog via backend
  searchProducts: (query) => fetchApi(`/products/search?q=${encodeURIComponent(query)}`),

  // Tracked products CRUD & actions
  getTrackedProducts: (status = 'all') => fetchApi(`/tracked-products?status=${encodeURIComponent(status)}`),
  getTrackedProductById: (id) => fetchApi(`/tracked-products/${id}`),
  trackProduct: (productData) => fetchApi('/tracked-products', {
    method: 'POST',
    body: JSON.stringify(productData)
  }),
  triggerScrape: (id) => fetchApi(`/tracked-products/${id}/scrape`, {
    method: 'POST'
  }),
  getProductHistory: (id) => fetchApi(`/tracked-products/${id}/history`),
  getProductLogs: (id) => fetchApi(`/tracked-products/${id}/logs`)
};
