import { extractProductData } from './extractor.js';
import { priceHistoryRepository as defaultPriceHistoryRepo } from '../db/priceHistoryRepository.js';
import { scrapeLogRepository as defaultScrapeLogRepo } from '../db/scrapeLogRepository.js';
import { productRepository as defaultProductRepo } from '../db/productRepository.js';
import { config } from '../config/env.js';

const MAX_ATTEMPTS = 3;

// Helper for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Active in-flight scrapes map for concurrency control & coalescing duplicate requests
const activeScrapes = new Map();

/**
 * Main state machine for scraping a product, validating it, and persisting the outcome.
 * Guarantees zero-garbage is written to the database.
 * Handles concurrency, bounded retries, honest logging, and data integrity.
 * 
 * @param {string} productId - The internal UUID of the tracked product
 * @param {object} options - Options containing externalStoreId, logger, repos, etc.
 */
export async function scrapeProduct(productId, options = {}) {
    const logger = options.logger || console;

    // Handle concurrent / duplicate scrapes for the same product
    if (activeScrapes.has(productId)) {
        logger.info(`Duplicate scrape detected for product ${productId}. Coalescing with active scrape in progress.`);
        return await activeScrapes.get(productId);
    }

    const scrapePromise = (async () => {
        const priceHistoryRepo = options.priceHistoryRepo || defaultPriceHistoryRepo;
        const scrapeLogRepo = options.scrapeLogRepo || defaultScrapeLogRepo;
        const productRepo = options.productRepo || defaultProductRepo;

        // Determine external store ID and product URL
        let externalStoreId = options.externalStoreId;
        let product = null;

        if (!externalStoreId && !options.url) {
            product = await productRepo.getProductById(productId);
            if (!product) {
                throw new Error(`Product with ID ${productId} not found.`);
            }
            externalStoreId = product.external_store_id;
        }

        const baseUrl = options.baseUrl || config.mockStoreUrl || 'https://demo.inelabteamdev.com';
        const productUrl = options.url || product?.store_url || `${baseUrl}/product/${externalStoreId}`;
        
        let attempt = 1;
        let finalError = null;

        while (attempt <= MAX_ATTEMPTS) {
            logger.info(`Starting scrape attempt ${attempt} for product ${productId} at ${productUrl}`);
            const startTime = Date.now();
            let status = 'failed';
            let errorMessage = null;
            let extractionResult = null;

            try {
                // 1. EXTRACT AND VALIDATE (Playwright handles interactions & returns validated data)
                const extractFn = options.extractorOverride || options.extractProductData || extractProductData;
                extractionResult = await extractFn(productUrl, {
                    headless: options.headless,
                    logger,
                    timeout: options.timeout,
                    selectorTimeout: options.selectorTimeout,
                    revealTimeout: options.revealTimeout,
                    stockTimeout: options.stockTimeout,
                    dwellMs: options.dwellMs
                });

                // 2. SAVE TO PRICE HISTORY (Zero-garbage guaranteed by repository)
                await priceHistoryRepo.recordPriceObservation({
                    productId: productId,
                    price: extractionResult.price,
                    stock: extractionResult.stock,
                    scrapedAt: new Date().toISOString()
                });

                // Update last scrape result and stats on the tracked product
                await productRepo.updateLastScrapeResult(productId, {
                    price: extractionResult.price,
                    stock: extractionResult.stock,
                    status: 'success',
                    scrapedAt: new Date().toISOString()
                });

                logger.info(`Successfully scraped and saved price history for ${productId}. Price: ${extractionResult.price}, Stock: ${extractionResult.stock}`);
                
                // 3. LOG SUCCESS AUDIT ENTRY
                const latencyMs = Date.now() - startTime;
                try {
                    await scrapeLogRepo.recordLog({
                        productId,
                        status: 'success',
                        attemptNumber: attempt,
                        durationMs: latencyMs,
                        errorMessage: null,
                        extractedPrice: extractionResult.price,
                        extractedStock: extractionResult.stock
                    });
                } catch (logErr) {
                    logger.error(`Failed to write scrape log to repository: ${logErr.message}`);
                }
                
                return extractionResult;

            } catch (error) {
                errorMessage = error.message;
                finalError = error;
                logger.warn(`Attempt ${attempt} failed for ${productId}: ${errorMessage}`);
                
                let errorType = 'SCRAPE_ERROR';
                if (extractionResult) {
                    errorType = 'DATABASE_ERROR';
                } else if (error.errorType === 'STRUCTURE_CHANGED' || error.name === 'StructureChangeError') {
                    errorType = 'STRUCTURE_CHANGED';
                } else if (error.errorType) {
                    errorType = error.errorType;
                }
                
                if (attempt < MAX_ATTEMPTS && errorType !== 'DATABASE_ERROR') {
                    status = 'retried';
                } else {
                    status = 'failed';
                }

                // 4. LOG THE FAILED / RETRIED ATTEMPT
                const latencyMs = Date.now() - startTime;
                try {
                    await scrapeLogRepo.recordLog({
                        productId,
                        status,
                        attemptNumber: attempt,
                        durationMs: latencyMs,
                        errorMessage,
                        errorType
                    });
                } catch (logErr) {
                    logger.error(`Failed to write scrape log to repository: ${logErr.message}`);
                }

                // 5. BACKOFF & RETRY IF APPLICABLE
                if (status === 'retried') {
                    const backoffMs = options.retryDelayMs !== undefined ? options.retryDelayMs : attempt * 1500;
                    logger.info(`Waiting ${backoffMs}ms before attempt ${attempt + 1}...`);
                    await delay(backoffMs);
                    attempt++;
                } else {
                    break; // Max attempts reached
                }
            }
        }

        // On final failure after all attempts: update product's status to 'failed'
        // preserving old valid price and stock history
        try {
            await productRepo.updateLastScrapeResult(productId, {
                status: 'failed',
                scrapedAt: new Date().toISOString()
            });
        } catch (err) {
            logger.warn(`Failed to update last scrape status on tracked product: ${err.message}`);
        }

        logger.error(`Failed to scrape product ${productId} after ${MAX_ATTEMPTS} attempts.`);
        throw finalError; // Rethrow the last error after max attempts
    })();

    activeScrapes.set(productId, scrapePromise);
    try {
        return await scrapePromise;
    } finally {
        activeScrapes.delete(productId);
    }
}
