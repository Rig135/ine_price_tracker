import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { productRepository } from './productRepository.js';
import { priceHistoryRepository } from './priceHistoryRepository.js';
import { scrapeLogRepository } from './scrapeLogRepository.js';

export {
  getSupabaseClient,
  isSupabaseConfigured,
  productRepository,
  priceHistoryRepository,
  scrapeLogRepository
};

export const db = {
  products: productRepository,
  priceHistory: priceHistoryRepository,
  scrapeLogs: scrapeLogRepository,
  isConfigured: isSupabaseConfigured
};

export default db;
