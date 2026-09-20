import { Router } from 'express';
import { trackedProductController } from '../controllers/trackedProduct.controller.js';
import { validateUuidParam, validateTrackProduct } from '../middleware/validate.middleware.js';

const router = Router();

// POST /api/tracked-products
router.post('/', validateTrackProduct, trackedProductController.trackProduct);

// GET /api/tracked-products
router.get('/', trackedProductController.getTrackedProducts);

// GET /api/tracked-products/:id
router.get('/:id', validateUuidParam('id'), trackedProductController.getTrackedProductById);

// GET /api/tracked-products/:id/history
router.get('/:id/history', validateUuidParam('id'), trackedProductController.getProductPriceHistory);

// GET /api/tracked-products/:id/logs
router.get('/:id/logs', validateUuidParam('id'), trackedProductController.getProductScrapeLogs);

// POST /api/tracked-products/:id/scrape
router.post('/:id/scrape', validateUuidParam('id'), trackedProductController.triggerProductScrape);

export default router;
