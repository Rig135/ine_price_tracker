import { batchScrapeService } from '../services/batchScrape.service.js';

/**
 * Controller for batch scheduled scraping (/api/scrape/run)
 */
export const scraperController = {
  async runScheduledScrape(req, res, next) {
    try {
      const result = await batchScrapeService.runBatchScrape();

      res.status(200).json({
        success: true,
        message: 'Batch scrape completed',
        summary: result.summary,
        results: result.results
      });
    } catch (err) {
      if (err.statusCode === 409) {
        return res.status(409).json({
          success: false,
          error: {
            message: err.message,
            inProgress: true
          }
        });
      }
      next(err);
    }
  }
};
