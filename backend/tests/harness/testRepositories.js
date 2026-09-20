/**
 * Controlled in-memory repository spies for verifying database contracts and data integrity
 * during unreliable external system tests.
 */
export function createTestRepositories() {
  const products = new Map();
  const priceHistory = [];
  const scrapeLogs = [];

  let failOnPriceHistory = false;
  let failOnLogs = false;

  return {
    state: {
      products,
      priceHistory,
      scrapeLogs,
      setFailOnPriceHistory(val) { failOnPriceHistory = val; },
      setFailOnLogs(val) { failOnLogs = val; }
    },

    productRepo: {
      async getProductById(id) {
        if (!products.has(id)) {
          // Return a default product fixture if not explicitly registered
          return {
            id,
            external_store_id: 101,
            name: 'Fixture Product',
            last_price: 50.00,
            last_stock: 10,
            last_scrape_status: 'success'
          };
        }
        return products.get(id);
      },

      async updateLastScrapeResult(id, { price, stock, status, scrapedAt }) {
        let prod = products.get(id) || {
          id,
          external_store_id: 101,
          name: 'Fixture Product',
          last_price: 50.00,
          last_stock: 10,
          last_scrape_status: 'success'
        };

        prod = {
          ...prod,
          last_scrape_status: status,
          last_scraped_at: scrapedAt || new Date().toISOString()
        };

        // Strict rule: Only update price/stock if valid positive numbers
        if (price !== undefined && price !== null && price > 0) {
          prod.last_price = price;
        }
        if (stock !== undefined && stock !== null && stock >= 0) {
          prod.last_stock = stock;
        }

        products.set(id, prod);
        return prod;
      }
    },

    priceHistoryRepo: {
      async recordPriceObservation(obs) {
        if (failOnPriceHistory) {
          throw new Error('Database Connection Error: Connection terminated unexpectedly (Simulated DB failure)');
        }

        const { productId, price, stock, scrapedAt } = obs || {};
        if (!productId) throw new Error('Validation Error: productId is required');
        if (price === null || price === undefined || isNaN(price) || price <= 0) {
          throw new Error(`Validation Error: Invalid price "${price}"`);
        }
        if (stock === null || stock === undefined || isNaN(stock) || stock < 0) {
          throw new Error(`Validation Error: Invalid stock "${stock}"`);
        }

        const record = {
          id: `ph-${priceHistory.length + 1}`,
          product_id: productId,
          price: Number(price),
          stock: Number(stock),
          scraped_at: scrapedAt || new Date().toISOString()
        };
        priceHistory.push(record);
        return record;
      },

      async getHistoryByProductId(productId) {
        return priceHistory.filter(h => h.product_id === productId);
      }
    },

    scrapeLogRepo: {
      async recordLog(entry) {
        if (failOnLogs) {
          throw new Error('Database Connection Error: scrape_logs write failure');
        }

        const { productId, status, attemptNumber, durationMs, errorMessage, errorType } = entry || {};
        if (!productId || !status) {
          throw new Error('Validation Error: productId and status required');
        }

        const log = {
          id: `log-${scrapeLogs.length + 1}`,
          product_id: productId,
          status,
          attempt_number: attemptNumber,
          duration_ms: durationMs,
          error_message: errorMessage,
          error_type: errorType,
          created_at: new Date().toISOString()
        };
        scrapeLogs.push(log);
        return log;
      },

      async createLog(entry) {
        return this.recordLog(entry);
      },

      async getLogsByProductId(productId) {
        return scrapeLogs.filter(l => l.product_id === productId);
      }
    }
  };
}
