const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Fetch wrapper for making API calls to the backend
 */
export async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
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
