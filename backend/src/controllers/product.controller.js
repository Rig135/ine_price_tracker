import { catalogService } from '../services/catalog.service.js';

/**
 * Controller for public product catalog search
 */
export const productController = {
  async search(req, res, next) {
    try {
      const query = req.query.q;
      const results = await catalogService.searchProducts(query);

      res.status(200).json({
        success: true,
        count: results.length,
        data: results
      });
    } catch (err) {
      next(err);
    }
  }
};
