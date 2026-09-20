import { getSupabaseClient } from './supabaseClient.js';

// In-memory fallback storage when Supabase is not configured (e.g. offline dev / tests)
const inMemoryProducts = new Map();

export const productRepository = {
  /**
   * Reset in-memory store (for testing)
   */
  _resetInMemoryStore() {
    inMemoryProducts.clear();
  },

  /**
   * Upsert a tracked product by external_store_id
   */
  async upsertProduct(productData) {
    const {
      externalStoreId,
      name,
      brand = null,
      category = null,
      sku = null,
      storeUrl,
      imageUrl = null,
      trackingStatus = 'active'
    } = productData || {};

    if (!externalStoreId || !name || !storeUrl) {
      throw new Error('externalStoreId, name, and storeUrl are required to track a product.');
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      const externalId = Number(externalStoreId);
      let existing = Array.from(inMemoryProducts.values()).find(p => p.external_store_id === externalId);
      const id = existing?.id || `00000000-0000-4000-8000-${String(externalId).padStart(12, '0')}`;
      const record = {
        id,
        external_store_id: externalId,
        name,
        brand,
        category,
        sku,
        store_url: storeUrl,
        image_url: imageUrl,
        tracking_status: trackingStatus,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_price: existing?.last_price || null,
        last_stock: existing?.last_stock || null,
        last_scrape_status: existing?.last_scrape_status || null,
        last_scraped_at: existing?.last_scraped_at || null
      };
      inMemoryProducts.set(id, record);
      return record;
    }

    const payload = {
      external_store_id: externalStoreId,
      name,
      brand,
      category,
      sku,
      store_url: storeUrl,
      image_url: imageUrl,
      tracking_status: trackingStatus,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('tracked_products')
      .upsert(payload, { onConflict: 'external_store_id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert tracked product: ${error.message}`);
    }

    return data;
  },

  /**
   * Get all tracked products, optionally filtered by status
   */
  async getTrackedProducts(filter = { status: 'active' }) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      let list = Array.from(inMemoryProducts.values());
      if (filter?.status && filter.status !== 'all') {
        list = list.filter(p => p.tracking_status === filter.status);
      }
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    let query = supabase
      .from('tracked_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.status && filter.status !== 'all') {
      query = query.eq('tracking_status', filter.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch tracked products: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Find tracked product by internal UUID
   */
  async getProductById(id) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return inMemoryProducts.get(id) || null;
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch product by id: ${error.message}`);
    }

    return data;
  },

  /**
   * Find tracked product by external store ID
   */
  async getProductByExternalId(externalStoreId) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return Array.from(inMemoryProducts.values()).find(p => p.external_store_id === Number(externalStoreId)) || null;
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('external_store_id', externalStoreId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch product by external id: ${error.message}`);
    }

    return data;
  },

  /**
   * Update tracking status ('active', 'paused', 'untracked')
   */
  async updateTrackingStatus(id, trackingStatus) {
    const validStatuses = ['active', 'paused', 'untracked'];
    if (!validStatuses.includes(trackingStatus)) {
      throw new Error(`Invalid tracking status: ${trackingStatus}. Must be one of ${validStatuses.join(', ')}`);
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      const prod = inMemoryProducts.get(id);
      if (!prod) return null;
      prod.tracking_status = trackingStatus;
      prod.updated_at = new Date().toISOString();
      return prod;
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .update({ tracking_status: trackingStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update tracking status: ${error.message}`);
    }

    return data;
  },

  /**
   * Update last scrape result on tracked product
   */
  async updateLastScrapeResult(id, { price, stock, status, scrapedAt }) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const prod = inMemoryProducts.get(id);
      if (!prod) return null;
      prod.last_scrape_status = status;
      prod.last_scraped_at = scrapedAt || new Date().toISOString();
      prod.updated_at = new Date().toISOString();
      if (price !== undefined && price !== null && price > 0) prod.last_price = price;
      if (stock !== undefined && stock !== null && stock >= 0) prod.last_stock = stock;
      return prod;
    }

    const updatePayload = {
      last_scrape_status: status,
      last_scraped_at: scrapedAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (price !== undefined && price !== null && price > 0) {
      updatePayload.last_price = price;
    }
    if (stock !== undefined && stock !== null && stock >= 0) {
      updatePayload.last_stock = stock;
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update last scrape result: ${error.message}`);
    }

    return data;
  },

  /**
   * Get products due for scheduled scrape (active products sorted by last_scraped_at)
   */
  async getProductsDueForScrape() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return Array.from(inMemoryProducts.values())
        .filter(p => p.tracking_status === 'active')
        .sort((a, b) => (new Date(a.last_scraped_at || 0)) - (new Date(b.last_scraped_at || 0)));
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('tracking_status', 'active')
      .order('last_scraped_at', { ascending: true, nullsFirst: true });

    if (error) {
      throw new Error(`Failed to fetch products due for scrape: ${error.message}`);
    }

    return data || [];
  }
};
