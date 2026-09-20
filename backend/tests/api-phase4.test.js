import app from '../src/app.js';
import { config } from '../src/config/env.js';
import { productRepository } from '../src/db/productRepository.js';
import { priceHistoryRepository } from '../src/db/priceHistoryRepository.js';
import { scrapeLogRepository } from '../src/db/scrapeLogRepository.js';
import { batchScrapeService } from '../src/services/batchScrape.service.js';

async function runApiTestSuite() {
  console.log('====================================================');
  console.log('      Phase 4: REST API Endpoints Test Suite        ');
  console.log('====================================================\n');

  // Reset in-memory stores for clean testing
  productRepository._resetInMemoryStore();
  priceHistoryRepository._resetInMemoryStore();
  scrapeLogRepository._resetInMemoryStore();

  // Start Express server on dynamic port
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test API Server running on ${baseUrl}\n`);

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
    // 1. GET /api/health
    // -------------------------------------------------------------------------
    console.log('--- 1. Health Endpoint ---');
    {
      const res = await fetch(`${baseUrl}/api/health`);
      const body = await res.json();

      assert(res.status === 200, 'GET /api/health returns 200 OK');
      assert(body.success === true, 'Health body has success: true');
      assert(body.status === 'ok', 'Health body has status: ok');
      assert(typeof body.uptime === 'number', 'Health body has uptime');
    }

    // -------------------------------------------------------------------------
    // 2. GET /api/products/search?q=<query>
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Product Search Endpoints ---');
    {
      // Missing query param
      const resNoQuery = await fetch(`${baseUrl}/api/products/search`);
      const bodyNoQuery = await resNoQuery.json();
      assert(resNoQuery.status === 400, 'GET /api/products/search without q returns 400 Bad Request');
      assert(bodyNoQuery.success === false, 'Error response has success: false');
      assert(bodyNoQuery.error.message.includes('required'), 'Error message specifies q is required');

      // Empty query param
      const resEmpty = await fetch(`${baseUrl}/api/products/search?q=%20%20`);
      assert(resEmpty.status === 400, 'GET /api/products/search with blank q returns 400 Bad Request');

      // Valid search query
      const resValid = await fetch(`${baseUrl}/api/products/search?q=fryer`);
      const bodyValid = await resValid.json();
      assert(resValid.status === 200, 'GET /api/products/search?q=fryer returns 200 OK');
      assert(bodyValid.success === true, 'Search response has success: true');
      assert(Array.isArray(bodyValid.data), 'Search response contains data array');
      assert(bodyValid.data.length > 0, 'Search finds matching products in catalog');
      assert(bodyValid.data[0].name.toLowerCase().includes('fryer'), 'Matched product contains search term');
      assert(bodyValid.data[0].external_store_id !== undefined, 'Matched product has external_store_id');
    }

    // -------------------------------------------------------------------------
    // 3. POST /api/tracked-products
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Track Product Endpoint ---');
    let createdProduct = null;
    {
      // Missing externalStoreId
      const resMissingId = await fetch(`${baseUrl}/api/tracked-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Product Without ID' })
      });
      assert(resMissingId.status === 400, 'POST /api/tracked-products missing externalStoreId returns 400');

      // Invalid externalStoreId (negative)
      const resNegId = await fetch(`${baseUrl}/api/tracked-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalStoreId: -5, name: 'Invalid ID Product' })
      });
      assert(resNegId.status === 400, 'POST /api/tracked-products with negative ID returns 400');

      // Missing name
      const resMissingName = await fetch(`${baseUrl}/api/tracked-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalStoreId: 232, name: '' })
      });
      assert(resMissingName.status === 400, 'POST /api/tracked-products missing name returns 400');

      // Valid track product request
      const resValid = await fetch(`${baseUrl}/api/tracked-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalStoreId: 232,
          name: 'Auralite Air Fryer Air',
          brand: 'Auralite',
          category: 'Kitchen',
          sku: 'AUR-10232'
        })
      });
      const bodyValid = await resValid.json();
      assert(resValid.status === 201, 'POST /api/tracked-products valid payload returns 201 Created');
      assert(bodyValid.success === true, 'Create response has success: true');
      assert(bodyValid.data.id !== undefined, 'Created product has UUID id');
      assert(bodyValid.data.external_store_id === 232, 'Created product has correct external_store_id');
      assert(bodyValid.data.tracking_status === 'active', 'Created product defaults to active tracking_status');
      
      createdProduct = bodyValid.data;
    }

    // -------------------------------------------------------------------------
    // 4. GET /api/tracked-products
    // -------------------------------------------------------------------------
    console.log('\n--- 4. List Tracked Products ---');
    {
      const res = await fetch(`${baseUrl}/api/tracked-products`);
      const body = await res.json();

      assert(res.status === 200, 'GET /api/tracked-products returns 200 OK');
      assert(body.success === true, 'List response has success: true');
      assert(Array.isArray(body.data), 'List response contains data array');
      assert(body.data.length >= 1, 'List contains tracked product');
      assert(body.data[0].id === createdProduct.id, 'Listed item matches created product');

      // Filter by status=active
      const resActive = await fetch(`${baseUrl}/api/tracked-products?status=active`);
      const bodyActive = await resActive.json();
      assert(resActive.status === 200, 'GET /api/tracked-products?status=active returns 200 OK');
      assert(bodyActive.data.length >= 1, 'Filter returns active products');
    }

    // -------------------------------------------------------------------------
    // 5. GET /api/tracked-products/:id
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Get Tracked Product by ID ---');
    {
      // Invalid UUID format
      const resInvalidUuid = await fetch(`${baseUrl}/api/tracked-products/invalid-uuid-123`);
      assert(resInvalidUuid.status === 400, 'GET /api/tracked-products/:id with malformed UUID returns 400 Bad Request');

      // Non-existent UUID
      const resNotFound = await fetch(`${baseUrl}/api/tracked-products/00000000-0000-0000-0000-000000000099`);
      assert(resNotFound.status === 404, 'GET /api/tracked-products/:id for non-existent UUID returns 404 Not Found');

      // Valid existing ID
      const resValid = await fetch(`${baseUrl}/api/tracked-products/${createdProduct.id}`);
      const bodyValid = await resValid.json();
      assert(resValid.status === 200, 'GET /api/tracked-products/:id for existing ID returns 200 OK');
      assert(bodyValid.success === true, 'Response has success: true');
      assert(bodyValid.data.id === createdProduct.id, 'Returns requested product details');
      assert(bodyValid.data.name === createdProduct.name, 'Product name matches');
    }

    // -------------------------------------------------------------------------
    // 6. GET /api/tracked-products/:id/history
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Get Product Price History ---');
    {
      // Invalid UUID
      const resInvalid = await fetch(`${baseUrl}/api/tracked-products/bad-id/history`);
      assert(resInvalid.status === 400, 'GET history with invalid UUID returns 400 Bad Request');

      // Non-existent UUID
      const resNotFound = await fetch(`${baseUrl}/api/tracked-products/00000000-0000-0000-0000-000000000099/history`);
      assert(resNotFound.status === 404, 'GET history for non-existent product returns 404 Not Found');

      // Seed a verified price observation
      await priceHistoryRepository.recordPriceObservation({
        productId: createdProduct.id,
        price: 3499.00,
        stock: 14,
        currency: 'INR'
      });

      // Existing product
      const resValid = await fetch(`${baseUrl}/api/tracked-products/${createdProduct.id}/history`);
      const bodyValid = await resValid.json();
      assert(resValid.status === 200, 'GET history for valid product returns 200 OK');
      assert(bodyValid.success === true, 'History response has success: true');
      assert(Array.isArray(bodyValid.data), 'History response contains data array');
      assert(bodyValid.data.length === 1, 'Returns recorded price history entry');
      assert(bodyValid.data[0].price === 3499.00, 'Price in history matches recorded value');
      assert(bodyValid.data[0].stock === 14, 'Stock in history matches recorded value');
    }

    // -------------------------------------------------------------------------
    // 7. GET /api/tracked-products/:id/logs
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Get Product Scrape Logs ---');
    {
      // Invalid UUID
      const resInvalid = await fetch(`${baseUrl}/api/tracked-products/bad-id/logs`);
      assert(resInvalid.status === 400, 'GET logs with invalid UUID returns 400 Bad Request');

      // Non-existent UUID
      const resNotFound = await fetch(`${baseUrl}/api/tracked-products/00000000-0000-0000-0000-000000000099/logs`);
      assert(resNotFound.status === 404, 'GET logs for non-existent product returns 404 Not Found');

      // Seed an honest scrape log entry
      await scrapeLogRepository.recordLog({
        productId: createdProduct.id,
        status: 'success',
        attemptNumber: 1,
        durationMs: 450
      });

      // Existing product
      const resValid = await fetch(`${baseUrl}/api/tracked-products/${createdProduct.id}/logs`);
      const bodyValid = await resValid.json();
      assert(resValid.status === 200, 'GET logs for valid product returns 200 OK');
      assert(bodyValid.success === true, 'Logs response has success: true');
      assert(Array.isArray(bodyValid.data), 'Logs response contains data array');
      assert(bodyValid.data.length === 1, 'Returns recorded scrape log entry');
      assert(bodyValid.data[0].status === 'success', 'Log status is success');
      assert(bodyValid.data[0].attempt_number === 1, 'Log attempt number is 1');
    }

    // -------------------------------------------------------------------------
    // 8. POST /api/tracked-products/:id/scrape (Validation & Route Checks)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Single Product Scrape Trigger Endpoint ---');
    {
      // Invalid UUID
      const resInvalid = await fetch(`${baseUrl}/api/tracked-products/not-a-uuid/scrape`, { method: 'POST' });
      assert(resInvalid.status === 400, 'POST /:id/scrape with invalid UUID returns 400 Bad Request');

      // Non-existent UUID
      const resNotFound = await fetch(`${baseUrl}/api/tracked-products/00000000-0000-0000-0000-000000000099/scrape`, { method: 'POST' });
      assert(resNotFound.status === 404, 'POST /:id/scrape for non-existent product returns 404 Not Found');
    }

    // -------------------------------------------------------------------------
    // 9. POST /api/scrape/run (Scheduled Batch Scrape & Cron Authentication)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Scheduled Batch Scrape (Cron) Endpoints ---');
    {
      // Unauthorized without secret
      const resNoAuth = await fetch(`${baseUrl}/api/scrape/run`, { method: 'POST' });
      assert(resNoAuth.status === 401, 'POST /api/scrape/run without auth returns 401 Unauthorized');

      // Unauthorized with wrong secret
      const resWrongAuth = await fetch(`${baseUrl}/api/scrape/run`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer wrong-secret-token' }
      });
      assert(resWrongAuth.status === 401, 'POST /api/scrape/run with wrong secret returns 401 Unauthorized');

      // Authorized via Bearer header
      const cronSecret = config.cronSecret || 'dev-cron-secret';
      
      // Track a second product to test multi-product batch processing
      await productRepository.upsertProduct({
        externalStoreId: 14,
        name: 'Summit Creatorbook Pro',
        storeUrl: 'https://demo.inelabteamdev.com/product/14'
      });

      // Mock batch scrape service to test HTTP response contract & concurrency lock
      // without launching long real Playwright browsers during fast API unit test
      let batchServiceCalled = false;
      const originalRunBatch = batchScrapeService.runBatchScrape;
      
      batchScrapeService.runBatchScrape = async () => {
        batchServiceCalled = true;
        return {
          summary: {
            total: 2,
            successful: 2,
            failed: 0,
            retried: 0,
            duration_ms: 250
          },
          results: [
            { productId: createdProduct.id, status: 'success', price: 2999, stock: 10 },
            { productId: 'mock-uuid-2', status: 'success', price: 79999, stock: 3 }
          ]
        };
      };

      const resAuthBearer = await fetch(`${baseUrl}/api/scrape/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cronSecret}` }
      });
      const bodyAuthBearer = await resAuthBearer.json();

      assert(resAuthBearer.status === 200, 'POST /api/scrape/run with valid Bearer token returns 200 OK');
      assert(bodyAuthBearer.success === true, 'Batch response has success: true');
      assert(bodyAuthBearer.summary.total === 2, 'Summary reports total products');
      assert(bodyAuthBearer.summary.successful === 2, 'Summary reports successful scrapes');
      assert(Array.isArray(bodyAuthBearer.results), 'Batch response includes results array');
      assert(batchServiceCalled === true, 'Batch scrape service was invoked');

      // Authorized via x-cron-secret header
      const resHeaderAuth = await fetch(`${baseUrl}/api/scrape/run`, {
        method: 'POST',
        headers: { 'x-cron-secret': cronSecret }
      });
      assert(resHeaderAuth.status === 200, 'POST /api/scrape/run with x-cron-secret header returns 200 OK');

      // Test Concurrency Lock (409 Conflict when job is already running)
      batchScrapeService.runBatchScrape = async () => {
        const err = new Error('A scheduled scrape run is already in progress.');
        err.statusCode = 409;
        throw err;
      };

      const resConflict = await fetch(`${baseUrl}/api/scrape/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cronSecret}` }
      });
      const bodyConflict = await resConflict.json();

      assert(resConflict.status === 409, 'POST /api/scrape/run returns 409 Conflict when run is in progress');
      assert(bodyConflict.success === false, 'Conflict response has success: false');
      assert(bodyConflict.error.inProgress === true, 'Conflict response indicates inProgress: true');

      // Restore original method
      batchScrapeService.runBatchScrape = originalRunBatch;
    }

    // -------------------------------------------------------------------------
    // 10. Summary & Test Results
    // -------------------------------------------------------------------------
    console.log('\n====================================================');
    console.log(`  Phase 4 API Tests Passed: ${passedTests} / ${totalTests}`);
    console.log('====================================================\n');

    if (passedTests === totalTests) {
      console.log('ALL PHASE 4 REST API ENDPOINTS VERIFIED WITH ZERO ERRORS!');
      process.exitCode = 0;
    } else {
      console.error(`FAILED: ${totalTests - passedTests} API tests failed.`);
      process.exitCode = 1;
    }

  } finally {
    server.close();
  }
}

runApiTestSuite().catch(err => {
  console.error('Fatal error running API test suite:', err);
  process.exit(1);
});
