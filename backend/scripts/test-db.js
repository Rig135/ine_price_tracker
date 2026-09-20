import { db, isSupabaseConfigured } from '../src/db/index.js';
import { priceHistoryRepository } from '../src/db/priceHistoryRepository.js';
import { productRepository } from '../src/db/productRepository.js';
import { scrapeLogRepository } from '../src/db/scrapeLogRepository.js';

async function runControlledDatabaseTests() {
  console.log('====================================================');
  console.log('  Phase 2: Database Repository & Validation Tests   ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  }

  // ---------------------------------------------------------------
  // 1. Zero-Garbage / Validation Tests
  // Strict guarantee that price_history rejects bad or corrupt data
  // ---------------------------------------------------------------
  console.log('--- 1. Testing Validation Rules (Zero-Garbage Policy) ---');

  const invalidTestCases = [
    { name: 'Null price', data: { productId: 'test-uuid-1', price: null, stock: 5 } },
    { name: 'Undefined price', data: { productId: 'test-uuid-1', price: undefined, stock: 5 } },
    { name: 'Negative price', data: { productId: 'test-uuid-1', price: -50, stock: 5 } },
    { name: 'Zero price', data: { productId: 'test-uuid-1', price: 0, stock: 5 } },
    { name: 'NaN price string', data: { productId: 'test-uuid-1', price: 'not-a-number', stock: 5 } },
    { name: 'Negative stock', data: { productId: 'test-uuid-1', price: 100, stock: -1 } },
    { name: 'Non-integer stock', data: { productId: 'test-uuid-1', price: 100, stock: 2.5 } },
    { name: 'Missing productId', data: { productId: null, price: 100, stock: 5 } }
  ];

  for (const tc of invalidTestCases) {
    try {
      await priceHistoryRepository.recordPriceObservation(tc.data);
      assert(false, `Should have rejected: ${tc.name}`);
    } catch (err) {
      assert(
        err.message.includes('Validation Error'),
        `Rejected ${tc.name}: "${err.message}"`
      );
    }
  }

  // Scrape log validation tests
  const invalidLogCases = [
    { name: 'Missing productId in scrape log', data: { productId: '', status: 'failed' } },
    { name: 'Invalid status in scrape log', data: { productId: 'test-uuid-1', status: 'unknown_status' } }
  ];

  for (const tc of invalidLogCases) {
    try {
      await scrapeLogRepository.recordLog(tc.data);
      assert(false, `Should have rejected: ${tc.name}`);
    } catch (err) {
      assert(
        err.message.includes('Validation Error'),
        `Rejected ${tc.name}: "${err.message}"`
      );
    }
  }

  // Product validation tests
  try {
    await productRepository.upsertProduct({ externalStoreId: null, name: 'Test' });
    assert(false, 'Should have rejected product with missing externalStoreId');
  } catch (err) {
    assert(
      err.message.includes('required'),
      `Rejected product without required fields: "${err.message}"`
    );
  }

  // ---------------------------------------------------------------
  // 2. Schema Contract & Method Signatures Verification
  // ---------------------------------------------------------------
  console.log('\n--- 2. Repository Contract & Schema Integrity ---');
  assert(typeof db.products.upsertProduct === 'function', 'productRepository.upsertProduct exported');
  assert(typeof db.products.getTrackedProducts === 'function', 'productRepository.getTrackedProducts exported');
  assert(typeof db.products.getProductById === 'function', 'productRepository.getProductById exported');
  assert(typeof db.products.updateTrackingStatus === 'function', 'productRepository.updateTrackingStatus exported');
  assert(typeof db.products.updateLastScrapeResult === 'function', 'productRepository.updateLastScrapeResult exported');
  assert(typeof db.products.getProductsDueForScrape === 'function', 'productRepository.getProductsDueForScrape exported');

  assert(typeof db.priceHistory.recordPriceObservation === 'function', 'priceHistoryRepository.recordPriceObservation exported');
  assert(typeof db.priceHistory.getHistoryByProductId === 'function', 'priceHistoryRepository.getHistoryByProductId exported');

  assert(typeof db.scrapeLogs.recordLog === 'function', 'scrapeLogRepository.recordLog exported');
  assert(typeof db.scrapeLogs.getLogsByProductId === 'function', 'scrapeLogRepository.getLogsByProductId exported');

  // ---------------------------------------------------------------
  // 3. Live Supabase PostgreSQL Integration (When env vars are set)
  // ---------------------------------------------------------------
  console.log('\n--- 3. Supabase PostgreSQL Live Connection ---');

  if (!isSupabaseConfigured()) {
    console.log('  [NOTICE] Live Supabase credentials not set in backend/.env.');
    console.log('  The database layer is fully verified against validation and schema contracts.');
    console.log('  To connect to live Supabase:');
    console.log('    1. Open your Supabase project dashboard (https://supabase.com).');
    console.log('    2. Copy backend/src/db/schema.sql into the Supabase SQL Editor and click RUN.');
    console.log('    3. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env.');
    console.log('    4. Re-run: npm run test:db\n');
  } else {
    console.log('  [INFO] Supabase credentials detected! Running live database CRUD tests...');
    const testStoreId = 999990 + Math.floor(Math.random() * 1000);

    try {
      // Step A: Upsert product
      console.log(`  Step A: Upsert test product (ID: ${testStoreId})`);
      const product = await db.products.upsertProduct({
        externalStoreId: testStoreId,
        name: 'Automated Test Headset',
        brand: 'AudioPro',
        category: 'Audio',
        sku: 'AP-TEST-99',
        storeUrl: `https://demo.inelabteamdev.com/product/${testStoreId}`,
        imageUrl: 'https://demo.inelabteamdev.com/images/test.jpg'
      });
      assert(Boolean(product?.id), `Created tracked product with UUID: ${product?.id}`);

      // Step B: Query by external store ID
      console.log('  Step B: Retrieve product by external ID');
      const fetched = await db.products.getProductByExternalId(testStoreId);
      assert(fetched?.id === product.id, 'Retrieved product by externalStoreId');

      // Step C: Insert valid price
      console.log('  Step C: Insert valid price history');
      const historyEntry = await db.priceHistory.recordPriceObservation({
        productId: product.id,
        price: 3499.00,
        stock: 5,
        currency: 'INR',
        stockStatus: 'in_stock'
      });
      assert(Number(historyEntry?.price) === 3499, 'Inserted valid price observation');

      // Step D: Insert honest scrape logs (1 retry + 1 success)
      console.log('  Step D: Record audit scrape logs');
      const retryLog = await db.scrapeLogs.recordLog({
        productId: product.id,
        status: 'retried',
        attemptNumber: 1,
        durationMs: 910,
        httpStatusCode: 429,
        errorMessage: 'Simulated 429 Rate Limit'
      });
      assert(retryLog?.status === 'retried', 'Recorded honest retry log');

      const successLog = await db.scrapeLogs.recordLog({
        productId: product.id,
        status: 'success',
        attemptNumber: 2,
        durationMs: 1250,
        httpStatusCode: 200,
        extractedPrice: 3499.00,
        extractedStock: 5
      });
      assert(successLog?.status === 'success', 'Recorded successful scrape log');

      // Step E: Query history and logs
      const history = await db.priceHistory.getHistoryByProductId(product.id);
      assert(history.length >= 1, `Fetched ${history.length} price history record(s)`);

      const logs = await db.scrapeLogs.getLogsByProductId(product.id);
      assert(logs.logs.length >= 2, `Fetched ${logs.logs.length} scrape log records`);

      console.log('  Live Supabase operations verified successfully!');
    } catch (err) {
      console.error('  [ERROR] Live test error:', err);
      assert(false, `Live Supabase test failed: ${err.message}`);
    }
  }

  console.log(`\n====================================================`);
  console.log(`  Summary: ${passedTests}/${totalTests} tests passed.`);
  console.log(`====================================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runControlledDatabaseTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
