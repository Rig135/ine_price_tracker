import { Router } from 'express';
import { scraperController } from '../controllers/scraper.controller.js';
import { requireCronAuth } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/scrape/run (Authenticated via CRON_SECRET)
router.post('/run', requireCronAuth, scraperController.runScheduledScrape);

export default router;
