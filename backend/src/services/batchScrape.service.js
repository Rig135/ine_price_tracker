import { productRepository } from '../db/productRepository.js';
import { scrapeProduct } from '../scraper/index.js';

let isBatchScrapeRunning = false;
let lastRunTime = null;

/**
 * Service for running scheduled batch scrapes across all active tracked products.
 * Guarantees fault isolation (one product failure does not halt others) and concurrency locking.
 */
export const batchScrapeService = {
  isJobRunning() {
    return isBatchScrapeRunning;
  },

  getLastRunTime() {
    return lastRunTime;
  },

  /**
   * Execute scheduled scrape run for all active tracked products
   */
  async runBatchScrape(options = {}) {
    if (isBatchScrapeRunning) {
      const error = new Error('A scheduled scrape run is already in progress.');
      error.statusCode = 409;
      error.inProgress = true;
      throw error;
    }

    isBatchScrapeRunning = true;
    const startTime = Date.now();
    lastRunTime = new Date().toISOString();

    const summary = {
      total: 0,
      successful: 0,
      failed: 0,
      retried: 0,
      duration_ms: 0
    };
    const results = [];

    const productRepo = options.productRepo || productRepository;

    try {
      // Find all active tracked products
      const activeProducts = await productRepo.getTrackedProducts({ status: 'active' });
      summary.total = activeProducts.length;

      for (const product of activeProducts) {
        try {
          const scrapeResult = await scrapeProduct(product.id, {
            ...options,
            externalStoreId: product.external_store_id,
            url: product.store_url,
            productRepo
          });

          summary.successful++;
          results.push({
            productId: product.id,
            externalStoreId: product.external_store_id,
            name: product.name,
            status: 'success',
            price: scrapeResult.price,
            stock: scrapeResult.stock
          });
        } catch (err) {
          // Fault isolation: continue with remaining products
          summary.failed++;
          results.push({
            productId: product.id,
            externalStoreId: product.external_store_id,
            name: product.name,
            status: 'failed',
            error: err.message
          });
        }
      }

      summary.duration_ms = Date.now() - startTime;

      return {
        summary,
        results
      };
    } finally {
      isBatchScrapeRunning = false;
    }
  }
};
