import { Router } from 'express';
import healthRoutes from './health.routes.js';
import productRoutes from './product.routes.js';
import trackedProductRoutes from './trackedProduct.routes.js';
import scraperRoutes from './scraper.routes.js';

const router = Router();

// GET /api/health
router.use('/health', healthRoutes);

// GET /api/products/search
router.use('/products', productRoutes);

// /api/tracked-products
router.use('/tracked-products', trackedProductRoutes);

// POST /api/scrape/run
router.use('/scrape', scraperRoutes);

export default router;
