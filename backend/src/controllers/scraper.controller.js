import { batchScrapeService } from '../services/batchScrape.service.js';

/**
 * Controller for batch scheduled scraping (/api/scrape/run)
 */
export const scraperController = {
  async runScheduledScrape(req, res, next) {
    try {
      const result = await batchScrapeService.runBatchScrape();

      // Keep response payload minimal (< 200 bytes) for external cron webhooks (e.g. cron-job.org)
      // which enforce strict response body size limits. Detailed product results can be requested via ?verbose=true.
      const isVerbose = req.query.verbose === 'true';

      res.status(200).json({
        success: true,
        message: 'Batch scrape completed',
        summary: result.summary,
        results: isVerbose ? result.results : []
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
