import { chromium } from 'playwright';
import { validateProductData } from './validator.js';
import { StructureChangeError } from './errors.js';

/**
 * Extracts product data using Playwright, handling the mock store's Wasm/Mouse-dwell challenges.
 * Includes deterministic change detection for missing selectors or modified storefront structure.
 * 
 * @param {string} productUrl - The URL of the product to scrape
 * @param {object} options - Options (headless, logger, etc.)
 */
async function extractProductData(productUrl, options = {}) {
    const headless = options.headless !== false; // default to true
    const logger = options.logger || console;
    
    let browser;
    try {
        browser = await chromium.launch({
            headless,
            slowMo: headless ? 0 : 250, // slow down for headed observability
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        // If in headed mode, show a visual indicator of the mouse
        if (!headless) {
            await page.addInitScript(() => {
                document.addEventListener('DOMContentLoaded', () => {
                    const dot = document.createElement('div');
                    dot.style.position = 'fixed';
                    dot.style.width = '10px';
                    dot.style.height = '10px';
                    dot.style.borderRadius = '50%';
                    dot.style.backgroundColor = 'red';
                    dot.style.pointerEvents = 'none';
                    dot.style.zIndex = '999999';
                    dot.id = 'playwright-mouse-dot';
                    document.body.appendChild(dot);
                    
                    document.addEventListener('mousemove', (e) => {
                        dot.style.left = `${e.clientX - 5}px`;
                        dot.style.top = `${e.clientY - 5}px`;
                    });
                });
            });
        }

        const pageTimeout = options.timeout || 30000;
        const selectorTimeout = options.selectorTimeout || 15000;
        const revealTimeout = options.revealTimeout || 10000;
        const stockTimeout = options.stockTimeout || 5000;
        const dwellMs = options.dwellMs !== undefined ? options.dwellMs : 1000;

        logger.info(`Navigating to ${productUrl}`);
        const response = await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: pageTimeout });
        
        if (!response || !response.ok()) {
            throw new Error(`Failed to load page. HTTP Status: ${response ? response.status() : 'Unknown'}`);
        }

        let pageTitle = '';
        try {
            pageTitle = await page.title();
        } catch {
            // non-fatal
        }

        logger.info('Waiting for .price-block to appear');
        try {
            await page.waitForSelector('.price-block', { state: 'visible', timeout: selectorTimeout });
        } catch (err) {
            throw new StructureChangeError({
                reason: 'MISSING_SELECTOR',
                failedSelector: '.price-block',
                url: productUrl,
                pageTitle,
                details: `Price container element (.price-block) not found within ${selectorTimeout}ms`
            });
        }

        const priceBlock = page.locator('.price-block');
        await priceBlock.scrollIntoViewIfNeeded();
        const boundingBox = await priceBlock.boundingBox();
        
        if (!boundingBox) {
            throw new StructureChangeError({
                reason: 'INTERACTION_FAILED',
                failedSelector: '.price-block',
                url: productUrl,
                pageTitle,
                details: 'Could not find bounding box for .price-block'
            });
        }

        logger.info('Simulating human mouse movement to .price-block');
        // Live site anti-bot requires >= 8 moves spaced by >= 40ms and >= 600ms dwell
        for (let i = 0; i < 10; i++) {
            const moveX = boundingBox.x + 20 + i * 6;
            const moveY = boundingBox.y + 20 + (i % 2) * 5;
            await page.mouse.move(moveX, moveY);
            await page.waitForTimeout(45);
        }
        
        if (dwellMs > 0) {
            const actualDwell = Math.max(dwellMs, 650);
            logger.info(`Dwelling for ${actualDwell}ms`);
            await page.waitForTimeout(actualDwell);
        }
        
        logger.info('Clicking to reveal price');
        const revealBtn = page.locator('.price-block button, button:has-text("Reveal price")').first();
        if ((await revealBtn.count()) > 0 && (await revealBtn.isVisible())) {
            await revealBtn.click();
        } else {
            const targetX = boundingBox.x + boundingBox.width / 2;
            const targetY = boundingBox.y + boundingBox.height / 2;
            await page.mouse.click(targetX, targetY);
        }

        logger.info('Waiting for .price-success element');
        try {
            await page.waitForSelector('.price-success', { state: 'visible', timeout: revealTimeout });
        } catch (err) {
            throw new StructureChangeError({
                reason: 'MISSING_SELECTOR',
                failedSelector: '.price-success',
                missingField: 'price',
                url: productUrl,
                pageTitle,
                details: `Price element (.price-success) not revealed after interaction within ${revealTimeout}ms`
            });
        }

        logger.info('Extracting raw price and stock');
        let rawPrice = null;

        // Check if there are nested spans inside .price-main (live storefront structure with decoys/MRP)
        const priceMain = page.locator('.price-main');
        if ((await priceMain.count()) > 0) {
            const spans = await priceMain.locator('span').all();
            for (const span of spans) {
                const isVis = await span.isVisible();
                if (!isVis) continue;
                const style = (await span.getAttribute('style')) || '';
                if (style.includes('line-through')) continue;
                const text = (await span.innerText()).trim();
                if (/\d/.test(text) && !text.includes('%')) {
                    rawPrice = text;
                    break;
                }
            }
        }

        // Fallback to direct text of .price-success
        if (!rawPrice) {
            rawPrice = await page.locator('.price-success').innerText();
        }
        
        let rawStock = null;
        try {
            await page.waitForSelector('.stock-badge', { state: 'visible', timeout: stockTimeout });
            rawStock = await page.locator('.stock-badge').innerText();
        } catch (err) {
            logger.warn('Could not find .stock-badge on page');
            throw new StructureChangeError({
                reason: 'MISSING_SELECTOR',
                failedSelector: '.stock-badge',
                missingField: 'stock',
                url: productUrl,
                pageTitle,
                details: `Stock status badge (.stock-badge) not found within ${stockTimeout}ms`
            });
        }

        logger.info(`Extracted raw data: price=${rawPrice}, stock=${rawStock}`);

        // Validate data to ensure zero garbage and detect format/missing field anomalies
        return validateProductData({
            rawPrice,
            rawStock,
            url: productUrl
        });

    } catch (error) {
        logger.error(`Extraction failed: ${error.message}`);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

export {
    extractProductData
};
