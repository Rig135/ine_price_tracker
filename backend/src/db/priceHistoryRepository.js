import { getSupabaseClient } from './supabaseClient.js';

// In-memory fallback storage when Supabase is not configured
const inMemoryHistory = [];

export const priceHistoryRepository = {
  _resetInMemoryStore() {
    inMemoryHistory.length = 0;
  },

  /**
   * Insert a verified price & stock observation into price_history.
   * STRICT: Never store price history when price or stock data is invalid or missing.
   */
  async recordPriceObservation(observation) {
    const {
      productId,
      price,
      stock,
      currency = 'INR',
      stockStatus = 'in_stock',
      scrapedAt = new Date().toISOString()
    } = observation || {};

    // Strict validation: Reject null, undefined, NaN, negative, or non-numeric values
    if (!productId) {
      throw new Error('Validation Error: productId is required to record price history.');
    }

    const numPrice = Number(price);
    if (price === null || price === undefined || isNaN(numPrice) || numPrice <= 0 || !isFinite(numPrice)) {
      throw new Error(`Validation Error: Invalid price "${price}". Price must be a positive number.`);
    }

    const numStock = Number(stock);
    if (stock === null || stock === undefined || isNaN(numStock) || numStock < 0 || !isFinite(numStock) || !Number.isInteger(numStock)) {
      throw new Error(`Validation Error: Invalid stock "${stock}". Stock must be a non-negative integer.`);
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      const record = {
        id: `ph-${inMemoryHistory.length + 1}`,
        product_id: productId,
        price: numPrice,
        currency,
        stock: numStock,
        stock_status: stockStatus,
        scraped_at: scrapedAt
      };
      inMemoryHistory.push(record);
      return record;
    }

    const payload = {
      product_id: productId,
      price: numPrice,
      currency,
      stock: numStock,
      stock_status: stockStatus,
      scraped_at: scrapedAt
    };

    const { data, error } = await supabase
      .from('price_history')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record price history: ${error.message}`);
    }

    return data;
  },

  /**
   * Retrieve price and stock history for a product sorted chronologically
   */
  async getHistoryByProductId(productId, options = { limit: 100 }) {
    const limit = options?.limit || 100;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return inMemoryHistory
        .filter(h => h.product_id === productId)
        .slice(-limit);
    }

    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', productId)
      .order('scraped_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch price history: ${error.message}`);
    }

    return data || [];
  }
};
