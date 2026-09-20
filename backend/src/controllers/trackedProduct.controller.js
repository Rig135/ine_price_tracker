import { productRepository } from '../db/productRepository.js';
import { priceHistoryRepository } from '../db/priceHistoryRepository.js';
import { scrapeLogRepository } from '../db/scrapeLogRepository.js';
import { scrapeProduct } from '../scraper/index.js';

/**
 * Controller for managing tracked products, history, logs, and single-product scrape triggers.
 */
export const trackedProductController = {
  /**
   * POST /api/tracked-products
   */
  async trackProduct(req, res, next) {
    try {
      const product = await productRepository.upsertProduct(req.cleanBody);
      res.status(201).json({
        success: true,
        message: 'Product tracked successfully',
        data: product
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/tracked-products
   */
  async getTrackedProducts(req, res, next) {
    try {
      const status = req.query.status || 'all';
      const products = await productRepository.getTrackedProducts({ status });

      res.status(200).json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/tracked-products/:id
   */
  async getTrackedProductById(req, res, next) {
    try {
      const product = await productRepository.getProductById(req.params.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: { message: `Tracked product with ID '${req.params.id}' not found.` }
        });
      }

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/tracked-products/:id/history
   */
  async getProductPriceHistory(req, res, next) {
    try {
      const product = await productRepository.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: { message: `Tracked product with ID '${req.params.id}' not found.` }
        });
      }

      const limit = Math.min(Math.max(1, Number(req.query.limit) || 100), 500);
      const history = await priceHistoryRepository.getHistoryByProductId(req.params.id, { limit });

      res.status(200).json({
        success: true,
        count: history.length,
        data: history
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/tracked-products/:id/logs
   */
  async getProductScrapeLogs(req, res, next) {
    try {
      const product = await productRepository.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: { message: `Tracked product with ID '${req.params.id}' not found.` }
        });
      }

      const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const { logs, total } = await scrapeLogRepository.getLogsByProductId(req.params.id, { limit, offset });

      res.status(200).json({
        success: true,
        total,
        count: logs.length,
        data: logs
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/tracked-products/:id/scrape
   */
  async triggerProductScrape(req, res) {
    try {
      const product = await productRepository.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: { message: `Tracked product with ID '${req.params.id}' not found.` }
        });
      }

      const result = await scrapeProduct(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Product scraped successfully',
        data: {
          productId: req.params.id,
          price: result.price,
          stock: result.stock,
          scrapedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      // Scraper error should be reported cleanly with 502 Bad Gateway
      res.status(502).json({
        success: false,
        error: {
          message: `Scrape failed: ${err.message}`,
          productId: req.params.id
        }
      });
    }
  }
};
