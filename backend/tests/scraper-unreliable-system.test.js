import { MockStorefrontServer } from './harness/mockStorefront.js';
import { createTestRepositories } from './harness/testRepositories.js';
import { scrapeProduct } from '../src/scraper/index.js';
import { validateProductData, sanitizeAndParsePrice, sanitizeAndParseStock } from '../src/scraper/validator.js';

// Test logger that suppresses noise unless debugging
const testLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  log: () => {}
};

async function runUnreliableSystemTestSuite() {
  console.log('================================================================');
  console.log('   Scraper Unreliable External System Test Suite (17 Scenarios)  ');
  console.log('================================================================\n');

  const mockServer = new MockStorefrontServer();
  const port = await mockServer.start();
  const baseUrl = mockServer.getBaseUrl();
  console.log(`Mock Storefront Server listening on ${baseUrl}\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName} - ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Successful scrape
    // -------------------------------------------------------------------------
    console.log('--- 1. Successful Scrape ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-1';
      
      const result = await scrapeProduct(productId, {
        url: `${baseUrl}/product/success`,
        logger: testLogger,
        productRepo,
        priceHistoryRepo,
        scrapeLogRepo,
        dwellMs: 50
      });

      assert(result.price === 79.99, 'Scenario 1: Extracted correct price (79.99)', `Got: ${result.price}`);
      assert(result.stock === 18, 'Scenario 1: Extracted correct stock (18)', `Got: ${result.stock}`);
      assert(state.priceHistory.length === 1, 'Scenario 1: Valid price observation recorded in price_history');
      assert(state.priceHistory[0].price === 79.99, 'Scenario 1: price_history price matches');
      assert(state.scrapeLogs.length === 1, 'Scenario 1: Exactly 1 scrape log recorded');
      assert(state.scrapeLogs[0].status === 'success', 'Scenario 1: Scrape log marked status = success');
      assert(state.scrapeLogs[0].attempt_number === 1, 'Scenario 1: Log attempt_number = 1');
      assert(state.products.get(productId)?.last_scrape_status === 'success', 'Scenario 1: Product last_scrape_status = success');
    }

    // -------------------------------------------------------------------------
    // Scenario 2: Slow response
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Slow Response ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-2';

      const result = await scrapeProduct(productId, {
        url: `${baseUrl}/product/slow`,
        logger: testLogger,
        productRepo,
        priceHistoryRepo,
        scrapeLogRepo,
        dwellMs: 50,
        timeout: 5000 // allows slow response to complete
      });

      assert(result.price === 149.00, 'Scenario 2: Successfully scraped slow page', `Got: ${result.price}`);
      assert(result.stock === 5, 'Scenario 2: Correct stock from slow page', `Got: ${result.stock}`);
      assert(state.scrapeLogs.length === 1, 'Scenario 2: Scrape log created for slow response');
      assert(state.scrapeLogs[0].status === 'success', 'Scenario 2: Slow response marked success');
      assert(state.scrapeLogs[0].duration_ms >= 1000, 'Scenario 2: Duration correctly captures elapsed time (>1000ms)');
    }

    // -------------------------------------------------------------------------
    // Scenario 3: Request timeout
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Request Timeout ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-3';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/timeout`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          timeout: 1000, // short timeout to test fast
          retryDelayMs: 20
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 3: Scraper does not silently swallow timeout error');
      assert(state.priceHistory.length === 0, 'Scenario 3: No price history created on timeout failure');
      assert(state.scrapeLogs.length === 3, 'Scenario 3: Exactly 3 attempts logged (bounded retries)');
      assert(state.scrapeLogs[0].status === 'retried', 'Scenario 3: Attempt 1 logged as retried');
      assert(state.scrapeLogs[1].status === 'retried', 'Scenario 3: Attempt 2 logged as retried');
      assert(state.scrapeLogs[2].status === 'failed', 'Scenario 3: Attempt 3 logged as failed');
    }

    // -------------------------------------------------------------------------
    // Scenario 4: HTTP 500 Internal Server Error
    // -------------------------------------------------------------------------
    console.log('\n--- 4. HTTP 500 ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-4';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/500`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          retryDelayMs: 20
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 4: Error thrown on HTTP 500');
      assert(errorCaught.message.includes('500'), 'Scenario 4: Error message indicates HTTP 500');
      assert(state.priceHistory.length === 0, 'Scenario 4: Zero garbage in price_history for HTTP 500');
      assert(state.scrapeLogs.length === 3, 'Scenario 4: All 3 attempts logged');
      assert(state.scrapeLogs[2].status === 'failed', 'Scenario 4: Final attempt marked failed');
    }

    // -------------------------------------------------------------------------
    // Scenario 5: HTTP 404 Not Found
    // -------------------------------------------------------------------------
    console.log('\n--- 5. HTTP 404 ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-5';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/404`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          retryDelayMs: 20
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 5: Error thrown on HTTP 404');
      assert(errorCaught.message.includes('404'), 'Scenario 5: Error message mentions 404');
      assert(state.priceHistory.length === 0, 'Scenario 5: No price history for 404');
    }

    // -------------------------------------------------------------------------
    // Scenario 6: Temporary network failure (socket reset)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Temporary Network Failure ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-6';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/network-fail`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          retryDelayMs: 20
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 6: Socket destroy throws connection error');
      assert(state.priceHistory.length === 0, 'Scenario 6: Network failure prevents invalid data insertion');
      assert(state.scrapeLogs.length === 3, 'Scenario 6: Logged 3 bounded attempts for network drop');
    }

    // -------------------------------------------------------------------------
    // Scenario 7: Missing price
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Missing Price ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-7';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/missing-price`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          revealTimeout: 1000,
          retryDelayMs: 20,
          dwellMs: 50
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 7: Missing price throws error');
      assert(state.priceHistory.length === 0, 'Scenario 7: Missing price never saved to price_history');
    }

    // -------------------------------------------------------------------------
    // Scenario 8: Missing stock
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Missing Stock ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-8';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/missing-stock`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          stockTimeout: 1000,
          retryDelayMs: 20,
          dwellMs: 50
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 8: Missing stock badge is treated as extraction failure');
      assert(errorCaught.message.includes('stock'), 'Scenario 8: Error message indicates invalid/missing stock');
      assert(state.priceHistory.length === 0, 'Scenario 8: Missing stock rejected from price_history');
      assert(state.scrapeLogs.length === 3, 'Scenario 8: All 3 retry attempts logged');
      assert(state.scrapeLogs[2].error_type === 'STRUCTURE_CHANGED', 'Scenario 8: Missing stock element classified as STRUCTURE_CHANGED');
      assert(state.scrapeLogs[2].error_message.includes('.stock-badge'), 'Scenario 8: Diagnostic identifies missing .stock-badge');
    }

    // -------------------------------------------------------------------------
    // Scenario 9: Changed/unexpected selector
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Changed/Unexpected Selector ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-9';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/changed-selector`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          selectorTimeout: 1000,
          retryDelayMs: 20
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 9: Changed selector causes timeout/failure');
      assert(state.priceHistory.length === 0, 'Scenario 9: No history inserted when selectors change');
      assert(state.scrapeLogs.length === 3, 'Scenario 9: All 3 retry attempts logged honestly');
      assert(state.scrapeLogs[2].error_type === 'STRUCTURE_CHANGED', 'Scenario 9: Error type classified as STRUCTURE_CHANGED');
      assert(state.scrapeLogs[2].error_message.includes('.price-block'), 'Scenario 9: Diagnostic message specifies missing .price-block selector');
    }

    // -------------------------------------------------------------------------
    // Scenario 10: Malformed product data
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Malformed Product Data ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-10';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/malformed-data`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          retryDelayMs: 20,
          dwellMs: 50
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 10: Malformed data ($0.00 / negative stock) rejected by validation');
      assert(errorCaught.message.includes('Invalid price'), 'Scenario 10: Specific validation error for price');
      assert(state.priceHistory.length === 0, 'Scenario 10: Zero-garbage guarantee upheld for malformed data');
    }

    // -------------------------------------------------------------------------
    // Scenario 11: Retry followed by success
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Retry Followed By Success ---');
    {
      mockServer.resetStats();
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-11';

      const result = await scrapeProduct(productId, {
        url: `${baseUrl}/product/flaky`,
        logger: testLogger,
        productRepo,
        priceHistoryRepo,
        scrapeLogRepo,
        retryDelayMs: 50,
        dwellMs: 50
      });

      assert(result.price === 120.50, 'Scenario 11: Succeeds on attempt 2 after initial failure', `Price: ${result.price}`);
      assert(state.scrapeLogs.length === 2, 'Scenario 11: Exactly 2 logs recorded (1 retry + 1 success)');
      assert(state.scrapeLogs[0].status === 'retried', 'Scenario 11: Attempt 1 logged as retried');
      assert(state.scrapeLogs[0].attempt_number === 1, 'Scenario 11: Attempt 1 has attempt_number = 1');
      assert(state.scrapeLogs[1].status === 'success', 'Scenario 11: Attempt 2 logged as success');
      assert(state.scrapeLogs[1].attempt_number === 2, 'Scenario 11: Attempt 2 has attempt_number = 2');
      assert(state.priceHistory.length === 1, 'Scenario 11: Valid history record created on recovery');
      assert(state.priceHistory[0].price === 120.50, 'Scenario 11: price_history contains recovered price');
    }

    // -------------------------------------------------------------------------
    // Scenario 12: All retry attempts failing
    // -------------------------------------------------------------------------
    console.log('\n--- 12. All Retry Attempts Failing ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-12';
      
      // Initialize with previous valid price to verify preservation
      state.products.set(productId, {
        id: productId,
        external_store_id: 12,
        name: 'Existing Product',
        last_price: 95.00,
        last_stock: 4,
        last_scrape_status: 'success'
      });

      let errorCaught = null;
      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/always-fail`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          retryDelayMs: 20
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 12: Scraper rethrows error after all attempts fail');
      assert(state.scrapeLogs.length === 3, 'Scenario 12: Exactly 3 attempts logged (scraper does not retry forever)');
      assert(state.scrapeLogs[0].status === 'retried', 'Scenario 12: Attempt 1 is retried');
      assert(state.scrapeLogs[1].status === 'retried', 'Scenario 12: Attempt 2 is retried');
      assert(state.scrapeLogs[2].status === 'failed', 'Scenario 12: Attempt 3 is failed');
      assert(state.priceHistory.length === 0, 'Scenario 12: Zero invalid price history added');
      
      const prodAfter = state.products.get(productId);
      assert(prodAfter.last_price === 95.00, 'Scenario 12: Old valid price (95.00) remains intact after failure');
      assert(prodAfter.last_stock === 4, 'Scenario 12: Old valid stock (4) remains intact after failure');
      assert(prodAfter.last_scrape_status === 'failed', 'Scenario 12: Status correctly updated to failed');
    }

    // -------------------------------------------------------------------------
    // Scenario 13: Duplicate scheduled scrape
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Duplicate Scheduled Scrape ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-13';

      // Fire two scrapes concurrently for the exact same productId
      const p1 = scrapeProduct(productId, {
        url: `${baseUrl}/product/success`,
        logger: testLogger,
        productRepo,
        priceHistoryRepo,
        scrapeLogRepo,
        dwellMs: 100
      });

      const p2 = scrapeProduct(productId, {
        url: `${baseUrl}/product/success`,
        logger: testLogger,
        productRepo,
        priceHistoryRepo,
        scrapeLogRepo,
        dwellMs: 100
      });

      const [res1, res2] = await Promise.all([p1, p2]);

      assert(res1.price === res2.price, 'Scenario 13: Both concurrent requests resolve with same data');
      assert(state.priceHistory.length === 1, 'Scenario 13: Deduplication/coalescing ensures exactly 1 price_history row');
      assert(state.scrapeLogs.length === 1, 'Scenario 13: Exactly 1 scrape execution and log created');
    }

    // -------------------------------------------------------------------------
    // Scenario 14: Database failure after successful extraction
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Database Failure After Successful Extraction ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-14';

      // Enable simulated DB failure when price history insertion is attempted
      state.setFailOnPriceHistory(true);

      let errorCaught = null;
      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/success`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          retryDelayMs: 20,
          dwellMs: 50
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 14: Error rethrown when database rejects insertion');
      assert(errorCaught.message.includes('Database Connection Error'), 'Scenario 14: Preserves database error message');
      assert(state.priceHistory.length === 0, 'Scenario 14: Corrupted data not stored in price_history');
      assert(state.scrapeLogs.length === 1, 'Scenario 14: Only 1 attempt logged on immediate database failure');
      assert(state.scrapeLogs[0].error_type === 'DATABASE_ERROR', 'Scenario 14: Error type marked as DATABASE_ERROR');
    }

    // -------------------------------------------------------------------------
    // Scenario 15: Changed reveal structure (price element selector missing/changed)
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Changed Reveal Structure ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-15';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/changed-reveal-structure`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          revealTimeout: 1000,
          retryDelayMs: 20,
          dwellMs: 50
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 15: Scraper detects failure when reveal element changes');
      assert(errorCaught.message.includes('.price-success'), 'Scenario 15: Diagnostic specifies missing .price-success selector');
      assert(state.priceHistory.length === 0, 'Scenario 15: No invalid price history inserted on reveal structure change');
      assert(state.scrapeLogs.length === 3, 'Scenario 15: Logged bounded retry attempts');
      assert(state.scrapeLogs[2].error_type === 'STRUCTURE_CHANGED', 'Scenario 15: Error type logged as STRUCTURE_CHANGED');
      assert(state.scrapeLogs[2].error_message.includes('STRUCTURE_CHANGED'), 'Scenario 15: Error message contains structured diagnostic');
    }

    // -------------------------------------------------------------------------
    // Scenario 16: Changed stock selector (never silently interpret missing stock as zero)
    // -------------------------------------------------------------------------
    console.log('\n--- 16. Changed Stock Selector (Never Interpreted as Zero) ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-16';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/changed-stock-selector`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          stockTimeout: 1000,
          retryDelayMs: 20,
          dwellMs: 50
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 16: Missing stock badge triggers extraction failure');
      assert(errorCaught.errorType === 'STRUCTURE_CHANGED', 'Scenario 16: Error classified as StructureChangeError');
      assert(errorCaught.missingField === 'stock', 'Scenario 16: Identifies stock as the missing field');
      assert(state.priceHistory.length === 0, 'Scenario 16: Never silently inserts 0 stock or invalid history');
      assert(state.scrapeLogs[2].error_type === 'STRUCTURE_CHANGED', 'Scenario 16: Recorded STRUCTURE_CHANGED in scrape_logs');
      assert(state.scrapeLogs[2].error_message.includes('.stock-badge'), 'Scenario 16: Diagnostic specifies missing .stock-badge');
    }

    // -------------------------------------------------------------------------
    // Scenario 17: Completely redesigned page (missing expected fields)
    // -------------------------------------------------------------------------
    console.log('\n--- 17. Completely Redesigned Page ---');
    {
      const { productRepo, priceHistoryRepo, scrapeLogRepo, state } = createTestRepositories();
      const productId = 'prod-uuid-17';
      let errorCaught = null;

      try {
        await scrapeProduct(productId, {
          url: `${baseUrl}/product/redesigned-page`,
          logger: testLogger,
          productRepo,
          priceHistoryRepo,
          scrapeLogRepo,
          selectorTimeout: 1000,
          retryDelayMs: 20
        });
      } catch (err) {
        errorCaught = err;
      }

      assert(errorCaught !== null, 'Scenario 17: Redesigned page triggers structure change detection');
      assert(errorCaught.message.includes('New Redesigned Storefront'), 'Scenario 17: Diagnostic captures page title context');
      assert(state.priceHistory.length === 0, 'Scenario 17: Zero garbage guarantee upheld for redesigned pages');
      assert(state.scrapeLogs[2].error_type === 'STRUCTURE_CHANGED', 'Scenario 17: Logged as STRUCTURE_CHANGED');
    }

    // -------------------------------------------------------------------------
    // Verification Summary
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`  Tests Passed: ${passedTests} / ${totalTests}`);
    console.log('================================================================\n');

    if (passedTests === totalTests) {
      console.log('ALL 17 UNRELIABLE SYSTEM SCENARIOS PASSED WITH ZERO DEFECTS!');
      process.exitCode = 0;
    } else {
      console.error(`FAILED: ${totalTests - passedTests} tests failed.`);
      process.exitCode = 1;
    }

  } finally {
    await mockServer.stop();
    console.log('Mock Storefront Server closed.');
  }
}

runUnreliableSystemTestSuite().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
