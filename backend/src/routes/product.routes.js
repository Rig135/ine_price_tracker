import { Router } from 'express';
import { productController } from '../controllers/product.controller.js';
import { validateSearchQuery } from '../middleware/validate.middleware.js';

const router = Router();

// GET /api/products/search?q=<query>
router.get('/search', validateSearchQuery, productController.search);

export default router;
