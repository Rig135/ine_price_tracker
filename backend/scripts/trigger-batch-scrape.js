#!/usr/bin/env node

import 'dotenv/config';

/**
 * Manual CLI command to trigger a full scheduled scrape of all tracked products.
 * Can be run locally or in production without relying on cron-job.org:
 * 
 *   npm run scrape:run
 *   OR
 *   node scripts/trigger-batch-scrape.js
 */
async function main() {
  const port = process.env.PORT || 5001;
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
  const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret';

  console.log('====================================================');
  console.log('  INE Product Price Tracker: Scheduled Batch Scrape  ');
  console.log('====================================================');
  console.log(`Endpoint:    ${baseUrl}/api/scrape/run`);
  console.log(`Auth Method: Bearer token (CRON_SECRET)`);
  console.log(`Timestamp:   ${new Date().toISOString()}\n`);

  try {
    console.log('Triggering batch scrape across all active tracked products...\n');
    const startTime = Date.now();

    const response = await fetch(`${baseUrl}/api/scrape/run?verbose=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`
      }
    });

    const elapsed = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Batch scrape failed [HTTP ${response.status}]:`, data.error?.message || response.statusText);
      if (response.status === 409) {
        console.warn('  ⚠️ Another scheduled scrape job is already in progress.');
      } else if (response.status === 401) {
        console.error('  ⚠️ Authentication failed. Check your CRON_SECRET in backend/.env.');
      }
      process.exit(1);
    }

    console.log('✓ Batch scrape finished successfully!\n');
    console.log('---------------- Execution Summary -----------------');
    console.log(`  Total Tracked Products: ${data.summary?.total ?? 0}`);
    console.log(`  Successful Scrapes:     ${data.summary?.successful ?? 0}`);
    console.log(`  Failed Scrapes:         ${data.summary?.failed ?? 0}`);
    console.log(`  Duration:               ${data.summary?.duration_ms ?? elapsed} ms`);
    console.log('----------------------------------------------------\n');

    if (Array.isArray(data.results) && data.results.length > 0) {
      console.log('Detailed Product Results:');
      data.results.forEach((item, index) => {
        const statusBadge = item.status === 'success' ? '✓ SUCCESS' : '✗ FAILED';
        const priceStr = item.price ? `₹${Number(item.price).toFixed(2)}` : 'N/A';
        const stockStr = item.stock !== null && item.stock !== undefined ? `${item.stock} units` : 'N/A';
        console.log(`  [${index + 1}] ${statusBadge} | ${item.name || item.productId}`);
        if (item.status === 'success') {
          console.log(`      Price: ${priceStr} | Stock: ${stockStr}`);
        } else {
          console.log(`      Error: ${item.error || 'Scrape failed'}`);
        }
      });
    } else {
      console.log('  (No active tracked products were found to scrape)');
    }

    console.log('\n====================================================');
    console.log('  Job Complete. All attempts logged in database.    ');
    console.log('====================================================\n');
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
      console.error(`\n❌ Error: Could not connect to backend server at ${baseUrl}.`);
      console.error('   Please ensure the backend server is running:');
      console.error('   npm --prefix backend run dev');
    } else {
      console.error('\n❌ Unexpected error running batch scrape:', err.message);
    }
    process.exit(1);
  }
}

main();
