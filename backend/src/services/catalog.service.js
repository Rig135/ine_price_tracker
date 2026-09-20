import { config } from '../config/env.js';

let cachedCatalog = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Seed fallback catalog for deterministic searches when mock store network is slow/unreachable
const FALLBACK_CATALOG = [
  { id: 232, name: 'Auralite Air Fryer Air', brand: 'Auralite', category: 'Kitchen', sku: 'AUR-10232', description: 'The Auralite Air Fryer Air.' },
  { id: 14, name: 'Summit Creatorbook Pro', brand: 'Summit', category: 'Laptops', sku: 'SUM-10014', description: 'The Summit Creatorbook Pro.' },
  { id: 72, name: 'Vantablack Air Fryer Pro', brand: 'Vantablack', category: 'Kitchen', sku: 'VAN-10072', description: 'The Vantablack Air Fryer Pro.' },
  { id: 69, name: 'Copperpot Sous-Vide Wand Pro', brand: 'Copperpot', category: 'Kitchen', sku: 'COP-10069', description: 'The Copperpot Sous-Vide Wand Pro.' },
  { id: 506, name: 'Vantablack Ultrawide Two', brand: 'Vantablack', category: 'Monitors', sku: 'VAN-10506', description: 'The Vantablack Ultrawide Two.' },
  { id: 644, name: 'Summit Soundbar S', brand: 'Summit', category: 'Audio', sku: 'SUM-10644', description: 'The Summit Soundbar S.' }
];

/**
 * Service to search the mock store catalog using lightweight HTTP fetching.
 */
export const catalogService = {
  /**
   * Fetch catalog items with in-memory caching and fallback tolerance
   */
  async getCatalogItems() {
    const now = Date.now();
    if (cachedCatalog && now - lastFetchTime < CACHE_TTL_MS) {
      return cachedCatalog;
    }

    const baseUrl = config.mockStoreUrl || 'https://demo.inelabteamdev.com';
    try {
      const response = await fetch(`${baseUrl}/api/catalog?page=1&pageSize=60`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          cachedCatalog = data.items;
          lastFetchTime = now;
          return cachedCatalog;
        }
      }
    } catch {
      // Fallback on timeout or network error
    }

    // Return cached catalog if available, otherwise fallback seed
    return cachedCatalog || FALLBACK_CATALOG;
  },

  /**
   * Search catalog products by keyword or direct product ID
   */
  async searchProducts(query) {
    if (!query || typeof query !== 'string') return [];

    const cleanQuery = query.trim().toLowerCase();
    const isNumeric = /^\d+$/.test(cleanQuery);
    const results = [];

    // If query is an exact numeric product ID, try fetching it directly
    if (isNumeric) {
      const baseUrl = config.mockStoreUrl || 'https://demo.inelabteamdev.com';
      try {
        const directRes = await fetch(`${baseUrl}/api/product/${cleanQuery}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(3000)
        });
        if (directRes.ok) {
          const directItem = await directRes.json();
          results.push(this.formatProduct(directItem));
        }
      } catch {
        // Continue to catalog search
      }
    }

    const items = await this.getCatalogItems();
    for (const item of items) {
      if (results.some(r => r.external_store_id === item.id)) continue;

      const name = (item.name || '').toLowerCase();
      const brand = (item.brand || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const sku = (item.sku || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();

      if (
        name.includes(cleanQuery) ||
        brand.includes(cleanQuery) ||
        category.includes(cleanQuery) ||
        sku.includes(cleanQuery) ||
        desc.includes(cleanQuery)
      ) {
        results.push(this.formatProduct(item));
      }
    }

    // If no results from primary catalog page, check fallback seed
    if (results.length === 0) {
      for (const item of FALLBACK_CATALOG) {
        if (results.some(r => r.external_store_id === item.id)) continue;
        const name = (item.name || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const category = (item.category || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        if (
          name.includes(cleanQuery) ||
          brand.includes(cleanQuery) ||
          category.includes(cleanQuery) ||
          desc.includes(cleanQuery)
        ) {
          results.push(this.formatProduct(item));
        }
      }
    }

    return results;
  },

  /**
   * Format product object consistently for API consumers
   */
  formatProduct(item) {
    const baseUrl = config.mockStoreUrl || 'https://demo.inelabteamdev.com';
    return {
      external_store_id: item.id,
      name: item.name,
      brand: item.brand || null,
      category: item.category || null,
      sku: item.sku || null,
      description: item.description || null,
      store_url: `${baseUrl}/product/${item.id}`,
      image_url: item.imageUrl || null
    };
  }
};
