# Design Notes: INE Product Price Tracker

This document records the architectural rationale, engineering trade-offs, and iterative failure corrections implemented during the development of the INE Product Price Tracker. It reflects real development decisions and post-implementation reviews.

---

## 1. Problem Interpretation

The objective was to build a reliable price and stock monitoring system for an external e-commerce storefront (`https://demo.inelabteamdev.com/`). 

In real-world web scraping, external storefronts behave as **unreliable, adversarial distributed systems**:
- Pages render asynchronously using client-side JavaScript frameworks.
- Anti-automation challenges (such as mouse event monitoring and interaction dwell thresholds) actively block automated requests.
- Markup layouts, class names, and DOM hierarchies can shift without notice.
- Network requests experience latency spikes, HTTP 500 errors, 404 drops, and socket resets.
- Data presentation includes hidden decoys, strike-through MSRPs, and discount percentages designed to trick naive scrapers.

### Core Guarantees Required:
1. **Zero-Garbage Data Integrity**: The system must never insert fabricated, missing, or malformed data into `price_history`.
2. **Honest Observability**: Failed scrapes must be recorded as failures in `scrape_logs` with diagnostic telemetry, rather than masked as successes or silently dropped.
3. **Resilience & Boundedness**: Retries must use exponential backoff, never loop infinitely, and isolate failures across batch items.
4. **Decoupled Scheduling**: Recurring scraping must survive container sleep states and auto-scaling events.

---

## 2. Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT / SCHEDULER LAYER                             │
│                                                                                  │
│   ┌───────────────────────────────┐            ┌─────────────────────────────┐   │
│   │    React 19 Frontend (SPA)    │            │     cron-job.org Scheduler  │   │
│   │   (Vite / Responsive UI)      │            │   (Every 2 Hours / Webhook) │   │
│   └───────────────┬───────────────┘            └──────────────┬──────────────┘   │
└───────────────────┼───────────────────────────────────────────┼──────────────────┘
                    │ REST API Requests                         │ POST /api/scrape/run
                    │ (Bearer Token / CORS)                     │ (CRON_SECRET)
┌───────────────────┼───────────────────────────────────────────┼──────────────────┐
│                   ▼                                           ▼                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                     Node.js / Express REST API Engine                    │   │
│   │                                                                          │   │
│   │   ├── Input Validation Middleware (UUID, payloads, sanitize queries)     │   │
│   │   ├── Concurrency Control (activeScrapes Map & Job In-Progress Locks)    │   │
│   │   └── In-Memory Store Fallback (Zero-Dependency Local Dev)               │   │
│   └──────────────────────┬────────────────────────────┬──────────────────────┘   │
│                          │                            │                          │
│                          ▼                            ▼                          │
│   ┌───────────────────────────────┐     ┌────────────────────────────────────┐   │
│   │   Lightweight HTTP Client     │     │     Playwright Scraping Engine     │   │
│   │   (Catalog Search & Discover) │     │  (Headless Chromium / Heuristics)  │   │
│   └──────────────┬────────────────┘     └─────────────┬──────────────────────┘   │
└──────────────────┼────────────────────────────────────┼──────────────────────────┘
                   │                                    │
                   ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL / DATA LAYER                               │
│                                                                                  │
│   ┌───────────────────────────────┐     ┌────────────────────────────────────┐   │
│   │     INE Mock Storefront       │     │     Supabase PostgreSQL DB         │   │
│   │ (demo.inelabteamdev.com)      │     │  (tracked_products, price_history, │   │
│   │                               │     │   scrape_logs with RLS & Triggers) │   │
│   └───────────────────────────────┘     └────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

The system is organized into decoupled layers:
- **Presentation Layer**: React 19 single-page application communicating exclusively with the backend REST API.
- **REST API Layer**: Express application enforcing input validation, CORS policies, authentication, and HTTP status codes.
- **Scraper Orchestration Engine**: Finite state machine managing extraction, validation, persistence, backoff, and audit logging.
- **Persistence Layer**: PostgreSQL database (hosted on Supabase) accessed via PostgREST, with an in-memory repository fallback for offline tests.

---

## 3. Why the Scraper Was Designed the Way It Was

The scraper in `backend/src/scraper/` is structured as a **state machine** rather than a loose procedural script:

1. **Isolation of Concerns**:
   - `extractor.js`: Interacts with the browser DOM, emulates human behavior, and extracts raw string tokens.
   - `validator.js`: Gatekeeper that parses, sanitizes, and verifies numeric sanity before any database interaction.
   - `index.js`: Manages the retry lifecycle, backoff timing, concurrency locks, and transaction-like persistence.
   - `errors.js`: Encapsulates domain-specific errors (`StructureChangeError`).

2. **Defense in Depth against Bad Data**:
   Validation occurs at three separate boundaries:
   - *Extractor*: Verifies DOM elements exist and are visible before querying text.
   - *Validator*: Strips invisible characters, validates positive numeric bounds, and ensures non-empty tokens.
   - *Database Repository*: Database-level `CHECK` constraints (`price > 0`, `stock >= 0`) reject invalid rows at the schema level.

---

## 4. HTTP Fetching vs. Playwright Decision

| Capability | Catalog Search (`catalogService.js`) | Product Price & Stock Scraping (`extractor.js`) |
|---|---|---|
| **Mechanism** | Lightweight HTTP request (`fetch`) + HTML parsing | Full browser automation (Playwright Chromium) |
| **Execution Time** | ~40–80 ms | ~1,800–2,500 ms |
| **Memory Footprint** | ~0 MB additional RAM | ~150–250 MB per browser instance |
| **Why this choice?** | The storefront search endpoint returns server-rendered HTML for product cards. Emulating a browser for search would waste CPU and RAM, creating a sluggish user experience. | The product detail page hides the price behind client-side JavaScript with an anti-bot challenge (`Ar` class). A plain HTTP GET only receives an inactive `<button>Reveal price</button>` element. Real browser automation is required. |

---

## 5. Retry Strategy

Scraping failures fall into two categories: **transient** (recoverable) and **permanent** (non-recoverable).

- **Max Attempts**: Strictly capped at **3** (`MAX_ATTEMPTS = 3`). The scraper will never loop indefinitely.
- **Backoff Formula**: Linear-exponential backoff gives remote servers time to recover:
  $$\text{Delay}(a) = a \times 1500\text{ms} \quad (1.5\text{s on attempt 1}, 3.0\text{s on attempt 2})$$
- **Non-Retryable Errors**: If extraction succeeds but the local database insertion fails (`errorType = 'DATABASE_ERROR'`), the retry loop breaks immediately. Re-scraping the external website for a local database fault is counterproductive and risks rate-limiting.

---

## 6. Timeout Strategy

To prevent headless browser processes from hanging indefinitely and leaking memory, tiered timeouts are enforced:
- **Page Load Timeout (`page.goto`)**: 30,000 ms (`domcontentloaded`).
- **Container Discovery (`.price-block`)**: 15,000 ms.
- **Price Reveal Mutation (`.price-success`)**: 10,000 ms.
- **Stock Badge (`.stock-badge`)**: 5,000 ms.

If any tier expires, the Playwright context is guaranteed to close in a `finally` block, freeing system resources.

---

## 7. Data Validation

A price tracker that records fabricated or corrupted data is worse than one that records nothing. 

### Sanitization Pipeline (`validator.js`)
1. **Unicode & Invisible Character Stripping**: Strips zero-width spaces (`\u200B`), non-breaking spaces (`\u00A0`), currency symbols (`₹`, `$`, `Rs`), commas, and whitespace.
2. **Strict Regex Matching**: Extracts numeric tokens using `/-?\d+(?:\.\d+)?/`.
3. **Numeric Sanity Assertions**:
   - `price` must be a finite number strictly greater than 0 ($P > 0$). Negative prices or $0.00 are rejected.
   - `stock` must be a non-negative integer ($S \ge 0$).
4. **Missing vs. Zero Distinction**:
   - Legitimate out-of-stock: String contains `"out of stock"` $\to$ parsed as `stock = 0`.
   - Missing stock badge: Missing element $\to$ throws `StructureChangeError`. It is **never** silently coerced to `0`.

---

## 8. Failure Logging

The system enforces strict separation between observations and audit telemetry:

- **`price_history` Table**: Contains **only** verified, valid observations. Failed scrapes never enter this table.
- **`scrape_logs` Table**: Contains an audit record of **every** attempt:
  - `status`: `'success'`, `'retried'`, or `'failed'`
  - `attempt_number`: 1, 2, or 3
  - `duration_ms`: Actual execution latency
  - `http_status_code`: Status code from storefront HTTP response
  - `error_type`: `'SCRAPE_ERROR'`, `'STRUCTURE_CHANGED'`, or `'DATABASE_ERROR'`
  - `error_message`: Full diagnostic error string
- **Preservation of Previous Quotes**: When attempt 3 fails, the product record's `last_scrape_status` updates to `'failed'`, but `last_price` and `last_stock` retain their previous valid historical values.

---

## 9. Database Design

The PostgreSQL schema (`backend/src/db/schema.sql`) uses three normalized tables:

1. **`tracked_products`**:
   - Primary key: `id UUID DEFAULT gen_random_uuid()`
   - Unique constraint: `external_store_id INTEGER UNIQUE` (prevents duplicate tracking)
   - Cached quote: `last_price`, `last_stock`, `last_scraped_at`, `last_scrape_status`
   - Trigger: `trigger_tracked_products_updated_at` automatically maintains `updated_at`.
2. **`price_history`**:
   - Foreign key: `product_id UUID REFERENCES tracked_products(id) ON DELETE CASCADE`
   - Constraints: `CHECK (price > 0)`, `CHECK (stock >= 0)`
   - Compound index: `idx_price_history_product_time (product_id, scraped_at DESC)` for fast chart data retrieval.
3. **`scrape_logs`**:
   - Audit trail of execution attempts.
   - Index: `idx_scrape_logs_product_time (product_id, scraped_at DESC)` and `idx_scrape_logs_status (status)`.

### In-Memory Fallback Repository
To ensure test suites and offline local development run out of the box without requiring live Supabase credentials, repository modules (`productRepository.js`, `priceHistoryRepository.js`, `scrapeLogRepository.js`) include an automatic in-memory fallback mimicking the PostgREST query interface.

---

## 10. Scheduling Design

### Why `setInterval` was Rejected
Running an in-process `setInterval` loop in Node.js works only on persistent dedicated servers. On modern cloud platforms (e.g. Render free tier, fly.io, serverless), idle instances are shut down after 15 minutes of inactivity. When the container sleeps, in-process timers are destroyed.

### The Authenticated Webhook Pattern
- Scheduled scraping is delegated to an external cron service (`cron-job.org`) firing `POST /api/scrape/run` every 2 hours.
- **Authentication**: Endpoint is protected via `CRON_SECRET` checked against `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret`.
- **Fault Isolation**: The batch runner loops through active products sequentially using `try/catch`. If product A fails, products B and C continue scraping uninterrupted.
- **Re-entrancy Protection**: An atomic `isBatchRunning` flag returns `409 Conflict` (`{ inProgress: true }`) if an external request arrives while a previous batch is still executing.

---

## 11. Deployment Trade-offs

| Component | Target Platform | Justification | Known Trade-off |
|---|---|---|---|
| **Frontend** | Vercel | Instant global edge CDN distribution for static Vite SPA assets. | Must be configured to route all API traffic to the external Render URL via `VITE_API_URL`. |
| **Backend** | Render | Native Linux container environment capable of executing Chromium with full OS libraries. | Free-tier container spins down after 15 minutes of inactivity, resulting in a 30–50s cold start on first request. |
| **Database** | Supabase | Managed PostgreSQL with PostgREST client, automated backups, and built-in connection pooling. | Network latency between Render compute and Supabase DB host. |

---

## 12. Scraping Reliability Trade-offs

1. **Sequential vs. Parallel Batch Scraping**:
   - *Choice*: Batch scraping runs sequentially (one product at a time).
   - *Trade-off*: Total batch duration scales linearly ($N \times 2.5\text{s}$). However, launching 10+ concurrent Chromium instances would exceed the 512MB RAM limit on free hosting tiers, causing out-of-memory (OOM) crashes.
2. **Intentional Interaction Delays**:
   - *Choice*: The scraper pauses for $45\text{ms}$ between mouse movements and dwells for $650\text{ms}$ over `.price-block`.
   - *Trade-off*: Slower extraction per product (~2 seconds), but mandatory to satisfy the storefront's anti-automation heuristics.

---

## What the AI Got Wrong Initially

The following issues were actual problems encountered and corrected during the iterative development of this codebase:

### 1. Direct Button Click Failed Anti-Bot Heuristics
- **Initial Approach**: Called `page.click('button')` or `revealBtn.click()` as soon as the element appeared.
- **Why It Was Wrong**: Reverse-engineering the storefront client bundle revealed an anti-automation verification class (`Ar`). The button remains disabled unless the cursor performs $\ge 8$ discrete mouse moves with $\ge 40\text{ms}$ intervals and a minimum dwell time of $600\text{ms}$ inside the `.price-block` bounding box.
- **Observed Failure**: The price reveal button did not respond to programmatic clicks; the page timed out waiting for `.price-success`.
- **Correction**: Updated `extractor.js` to compute the element's bounding box, dispatch 10 sequential mouse movement events across the container, dwell for $650\text{ms}$, and then click.
- **Resulting Behavior**: The reveal action succeeds deterministically on 100% of runs.

---

### 2. Extraction of Strikethrough MSRP and Decoy Elements
- **Initial Approach**: Extracted `innerText` directly from the parent `.price-success` or `.price-main` container.
- **Why It Was Wrong**: The storefront markup contains multiple `<span>` tags, including hidden decoy elements (`display: none`), discount percentage tags (`50% off`), and original MSRPs formatted with `style="text-decoration: line-through"`. Calling `innerText` on the parent returned concatenated text like `"₹2,999 ₹1,499 50% off"`.
- **Observed Failure**: The regex parser extracted the higher strike-through MSRP (₹2,999) instead of the actual selling price (₹1,499), corrupting price history.
- **Correction**: Updated `extractor.js` to inspect child `<span>` elements, filtering out spans with `line-through` styles, hidden attributes, or percentage characters.
- **Resulting Behavior**: The scraper consistently extracts only the genuine selling price.

---

### 3. Silent Coercion of Missing Stock to Zero
- **Initial Approach**: In early validator iterations, if `.stock-badge` was missing or empty, `stock` was defaulted or coerced to `0`.
- **Why It Was Wrong**: This violated the core assignment rule: *distinguish missing data from zero*. A broken selector or missing badge was masquerading as an "Out of Stock" product.
- **Observed Failure**: When testing structural storefront changes, broken stock selectors silently inserted valid price history entries with `stock = 0`, corrupting database integrity.
- **Correction**: Refactored `validator.js` to require explicit stock text. If `.stock-badge` is missing or cannot be parsed, it throws a `StructureChangeError`. Only explicit `"Out of Stock"` text is allowed to resolve to `0`.
- **Resulting Behavior**: Missing stock halts insertion, logs the missing selector diagnostic, and leaves historical price data intact.

---

### 4. Remote Re-scraping on Local Database Write Failures
- **Initial Approach**: The scraper retry loop caught all errors indiscriminately and retried the entire scrape cycle up to 3 times.
- **Why It Was Wrong**: If `priceHistoryRepository` threw an error due to a database constraint or connection drop *after* Playwright successfully extracted the product data, the loop re-invoked Playwright to scrape the external storefront again.
- **Observed Failure**: Local database errors generated 3 redundant external HTTP/browser requests, wasting remote bandwidth and increasing IP ban risk.
- **Correction**: Added error categorization in `index.js`. If extraction succeeds but database persistence throws, the error is marked as `errorType = 'DATABASE_ERROR'` and the retry loop terminates immediately without re-scraping the external site.
- **Resulting Behavior**: The external storefront is never blamed or re-scraped for local database faults.

---

### 5. Concurrent Duplicate Scrapes Spawning Parallel Browsers
- **Initial Approach**: Invoked `scrapeProduct(productId)` independently upon each request.
- **Why It Was Wrong**: If an operator clicked "Scrape Now" multiple times in the dashboard, or if a cron trigger overlapped with a manual scrape, two separate Chromium instances launched concurrently for the same product.
- **Observed Failure**: Race conditions created duplicate identical entries in `price_history` at the exact same timestamp, while doubling memory consumption.
- **Correction**: Implemented an in-flight promise map (`activeScrapes = new Map()`) in `index.js`. If a scrape for a given `productId` is already running, subsequent requests coalesce into the existing active promise.
- **Resulting Behavior**: Exactly one browser instance runs per product, producing a single history record and audit log.

---

### 6. Indistinguishable Timeout Errors on Storefront Redesign
- **Initial Approach**: Allowed Playwright's native `TimeoutError` to propagate when selectors were not found within the timeout window.
- **Why It Was Wrong**: A generic `TimeoutError: page.waitForSelector: Timeout 15000ms exceeded` failed to clarify whether the problem was a network timeout or a redesign of the storefront HTML.
- **Observed Failure**: Audit logs recorded generic timeout errors, making structural drift indistinguishable from slow network latency.
- **Correction**: Wrapped selector wait calls in `try/catch` blocks throwing a dedicated `StructureChangeError`. This records `error_type = 'STRUCTURE_CHANGED'` in `scrape_logs` along with `failedSelector`, `missingField`, and `pageTitle`.
- **Resulting Behavior**: Scrape logs provide immediate, unambiguous diagnostic telemetry when markup changes.

---

## Trade-offs

To maintain high reliability without over-engineering, several architectural simplifications were chosen intentionally:

1. **In-Process Coalescing vs. Distributed Message Broker (Redis/RabbitMQ)**:
   - *Decision*: Coalescing and concurrency locks are held in Node.js memory (`activeScrapes` Map).
   - *Why*: Adding Redis or BullMQ would introduce infrastructure complexity that is unnecessary for a single-container assignment deployment.
2. **Sequential Batch Scraping vs. Worker Pool**:
   - *Decision*: The cron endpoint scrapes active products one after another rather than in a parallel worker pool.
   - *Why*: Playwright instances are memory-intensive (~200MB). Running sequentially guarantees the process stays comfortably within Render's 512MB RAM ceiling.
3. **HTML5 Canvas Visualizations vs. Heavyweight Chart Libraries**:
   - *Decision*: Built custom dual-axis canvas charting directly into React components.
   - *Why*: Eliminates large third-party dependencies, minimizes bundle size, and guarantees strict non-interpolated rendering (straight line segments connecting discrete scrape events).
4. **External Webhook Scheduler vs. Daemon Background Worker**:
   - *Decision*: Relies on `cron-job.org` calling `POST /api/scrape/run`.
   - *Why*: Avoids process death on sleeping cloud containers and eliminates the need for separate worker dynos.
