import 'dotenv/config';
import { scrapeProduct } from '../src/scraper/index.js';
import { extractProductData } from '../src/scraper/extractor.js';
import { productRepository } from '../src/db/productRepository.js';

const simulateFailure = process.argv.includes('--simulate-failure');
let attemptCount = 0;

async function customExtractor(url, options) {
    if (simulateFailure) {
        attemptCount++;
        if (attemptCount === 1) {
            console.log('\n[SIMULATION] Simulating a transient failure (e.g. network timeout or bad selector) on attempt 1...');
            // We wait a bit to make it visible
            await new Promise(resolve => setTimeout(resolve, 2000));
            throw new Error('Simulated transient failure for demonstration purposes.');
        }
    }
    return extractProductData(url, options);
}

async function main() {
    console.log('==================================================');
    console.log('Starting Headed Scrape Demonstration');
    console.log('==================================================');

    if (simulateFailure) {
        console.log('Mode: Failure Simulation Enabled (--simulate-failure)');
        console.log('This will force the first attempt to fail to demonstrate retry logic.');
    }

    try {
        const products = await productRepository.getAllTrackedProducts();
        if (products.length === 0) {
            console.error('No tracked products found. Please add a product first via the UI or API.');
            process.exit(1);
        }

        // Just grab the first active one
        const targetProduct = products[0];
        console.log(`\nTarget Product: ${targetProduct.name} (${targetProduct.id})`);
        console.log(`External Store ID: ${targetProduct.external_store_id}\n`);

        const result = await scrapeProduct(targetProduct.id, {
            headless: false, // Make the Playwright browser visible
            extractorOverride: customExtractor
        });

        console.log('\n==================================================');
        console.log('SCRAPE COMPLETED SUCCESSFULLY');
        console.log(`Price: ${result.price}`);
        console.log(`Stock: ${result.stock}`);
        console.log('==================================================');
        process.exit(0);
    } catch (err) {
        console.error('\n==================================================');
        console.error('SCRAPE FAILED');
        console.error(err.message);
        console.error('==================================================');
        process.exit(1);
    }
}

main();
