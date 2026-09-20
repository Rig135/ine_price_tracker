# Product Price Tracker

A production-ready, full-stack web application that tracks e-commerce product prices and inventory levels from the INE mock storefront (`https://demo.inelabteamdev.com/`). Designed to handle real-world scraping challenges—including asynchronous rendering, client-side anti-bot heuristics, storefront structural changes, and unreliable network conditions—with strict zero-garbage data integrity guarantees.

---

## Overview

E-commerce price monitoring systems frequently fail when storefronts deploy dynamic rendering, anti-automation challenges, or unpredictable layout updates. This project provides a robust, end-to-end price tracking pipeline:

1. **Catalog Search & Discovery**: Real-time product search across the INE storefront with partial and full name matching.
2. **Product Tracking Dashboard**: Clean, responsive operator UI displaying live prices, stock levels, historical status badges (`SUCCESS`, `RETRY`, `FAILED`), and observation timestamps.
3. **Dual-Axis History Visualization**: Interactive HTML5 canvas charts plotting price trends and live stock levels over time, paired with an audit fallback table.
4. **Reliable Scraper Engine**: Playwright-powered extraction engine engineered to overcome the storefront's client-side anti-bot dwell challenge, with bounded retries and exponential backoff.
5. **Deterministic Change Detection**: Automated identification of storefront markup alterations, logging diagnostic telemetry without corrupting historical data.
6. **Decoupled 2-Hour Scheduler**: Production-ready scheduled batch scraping triggered via an authenticated webhook compatible with external cron services (`cron-job.org`).

---

## Features

- **Storefront Catalog Search**: Instant product lookup with fast lightweight HTTP parsing.
- **Duplicate Tracking Prevention**: Unique database constraints prevent tracking the same product multiple times.
- **Human-Behavior Emulation**: Overcomes client-side anti-bot heuristics requiring multi-point mouse motion and minimum dwell times before revealing price data.
- **Zero-Garbage Data Integrity**: Strict validation pipeline ensures unverified, missing, or malformed prices and stock counts never enter `price_history`.
- **Honest Scrape Audit Trail**: Every attempt—including transient retries and final failures—is permanently recorded in `scrape_logs` with latency metrics and error diagnostics.
- **Fault-Isolated Batch Scraping**: Scheduled scraping iterates through tracked products independently; a single failing product never halts the remaining batch.
- **Dual-Axis Visualizations**: Synchronized price and inventory line charts with local timezone rendering, UTC transparency, and zero interpolation of unobserved data.
- **Headed Demo Mode with Cursor Visualization**: Visible browser execution mode featuring an on-screen mouse pointer and configurable failure simulation for demonstrations.

---

## Architecture

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
│   │   ├── Route Controllers & Input Validation Middleware                    │   │
│   │   ├── Concurrency Control (Active Job Coalescing & Re-entrancy Locks)    │   │
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

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Vanilla CSS Design System, HTML5 Canvas Charting |
| **Backend** | Node.js (ES Modules), Express 4, CORS, Dotenv |
| **Scraper** | Playwright (Chromium), Custom Anti-Bot Dwell Automation |
| **Database** | Supabase PostgreSQL, `@supabase/supabase-js` (PostgREST API) |
| **Scheduler** | External Cron Webhook (`cron-job.org`) |
| **Testing** | Node.js Test Harness, Assert, Express Mock Storefront Server |

---

## Project Structure

```text
.
├── backend/
│   ├── scripts/
│   │   ├── run-headed-scrape.js      # Headed scraper demo script with failure simulation
│   │   ├── test-db.js                # Supabase connectivity & schema validation
│   │   └── trigger-batch-scrape.js   # Manual CLI tool for batch scheduled scrapes
│   ├── src/
│   │   ├── config/
│   │   │   └── env.js                # Centralized environment configuration
│   │   ├── controllers/              # Request handlers (health, product, tracked, scraper)
│   │   ├── db/                       # Supabase client, repositories, and schema.sql
│   │   ├── middleware/               # Auth, validation, and global error handling
│   │   ├── routes/                   # Express route definitions
│   │   ├── scraper/
│   │   │   ├── errors.js             # Custom scraper errors (StructureChangeError)
│   │   │   ├── extractor.js          # Playwright DOM interaction & extraction
│   │   │   ├── index.js              # State machine, retries, backoff, and logging
│   │   │   └── validator.js          # Price & stock numeric sanity checking
│   │   ├── services/                 # Catalog search & batch scrape services
│   │   ├── app.js                    # Express app configuration & middleware
│   │   └── server.js                 # HTTP server entry point
│   ├── tests/
│   │   ├── harness/                  # Mock storefront server simulating network/DOM errors
│   │   ├── api-phase4.test.js        # REST API endpoint test suite (65 tests)
│   │   ├── phase7-scheduled-scrape.test.js # Scheduled scrape & fault isolation suite (14 tests)
│   │   └── scraper-unreliable-system.test.js # Scraper resilience test suite (17 scenarios)
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js             # Backend API fetch client
│   │   ├── components/               # React UI components (Cards, Search, Charts, Tables)
│   │   ├── utils/                    # Date/time & currency formatting utilities
│   │   ├── App.css                   # Component-specific styles
│   │   ├── App.jsx                   # Application root with view switching
│   │   ├── index.css                 # Core CSS design system & variables
│   │   └── main.jsx                  # React DOM root
│   ├── .env.example
│   └── package.json
├── .gitignore
├── DESIGN_NOTE.md                    # Technical design decisions and trade-offs
├── package.json                      # Monorepo root scripts
└── README.md
```

---

## Local Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**

### 2. Clone & Install Dependencies
Clone the repository and install dependencies across the monorepo:

```bash
git clone <repo-url>
cd ine_price_tracker

# Install backend and frontend dependencies in one command:
npm run install:all
```

Alternatively, install in each directory individually:
```bash
cd backend && npm install
npx playwright install chromium
cd ../frontend && npm install
```

---

## Environment Variables

Copy the example environment files in both `backend` and `frontend`:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Backend Variables (`backend/.env`)

| Variable | Required | Description | Default / Example |
|---|---|---|---|
| `PORT` | Optional | Port on which the Express backend listens. In production, Render injects this automatically. | `5001` |
| `NODE_ENV` | Optional | Environment mode (`development` or `production`). | `development` |
| `CORS_ORIGIN` | Optional | Origin allowed to make cross-origin requests to the API. In production, set to your Vercel URL. | `http://localhost:5173` |
| `SUPABASE_URL` | Optional* | Supabase project REST endpoint. Found in Supabase under *Project Settings > API*. | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional* | Supabase service role secret used for backend database operations. | `your-service-role-key` |
| `SUPABASE_ANON_KEY` | Optional* | Public anonymous key (used as a fallback if service role key is absent). | `your-anon-key` |
| `CRON_SECRET` | Required | Shared secret token used to authenticate batch scrape triggers (`POST /api/scrape/run`). | `dev-cron-secret` |
| `MOCK_STORE_URL` | Optional | Base URL of the target mock store catalog. | `https://demo.inelabteamdev.com` |

*\* Note: If Supabase credentials are left empty, the backend automatically activates an in-memory repository mock, enabling complete offline development and zero-dependency automated testing.*

### Frontend Variables (`frontend/.env`)

| Variable | Required | Description | Default / Example |
|---|---|---|---|
| `VITE_API_URL` | Required | Fully-qualified URL pointing to the backend `/api` route. | `http://localhost:5001/api` |

---

## Database Setup

The application uses PostgreSQL managed through Supabase.

### 1. Create Supabase Tables
1. Open your Supabase Project Dashboard.
2. Navigate to the **SQL Editor** on the left menu.
3. Open `backend/src/db/schema.sql` (or `backend/src/db/migrations/001_initial_schema.sql`).
4. Paste the entire SQL script into the editor and click **Run**.

### Schema Summary:
- **`tracked_products`**: Stores tracked item metadata (`external_store_id`, `name`, `store_url`, `tracking_status`), current quote cache (`last_price`, `last_stock`, `last_scraped_at`), and an `updated_at` trigger.
- **`price_history`**: Stores immutable, verified observations (`product_id`, `price`, `stock`, `currency`, `scraped_at`). Includes check constraints enforcing $price > 0$ and $stock \ge 0$.
- **`scrape_logs`**: Stores an audit log of every scrape attempt (`status`, `attempt_number`, `duration_ms`, `http_status_code`, `error_type`, `error_message`, `engine`).

### 2. Verify Database Connectivity
Test your Supabase connection and schema configuration:
```bash
cd backend
npm run test:db
```

---

## Running Frontend

From the repository root:
```bash
npm run dev:frontend
```
Or directly from `frontend/`:
```bash
cd frontend
npm run dev
```
The React development server will start at `http://localhost:5173`.

---

## Running Backend

From the repository root:
```bash
npm run dev:backend
```
Or directly from `backend/`:
```bash
cd backend
npm run dev
```
The backend server will start at `http://localhost:5001`.
Verify the health endpoint:
```bash
curl http://localhost:5001/api/health
```

---

## Running Tests

The test suite covers the database layer, API endpoints, scraper reliability under network/DOM faults, and scheduled batch scraping:

```bash
# Run the complete test suite from repository root:
npm test

# OR from the backend directory:
cd backend
npm test
```

### Individual Test Suites

| Command | Focus Area | Scenarios Covered |
|---|---|---|
| `npm run test:db` | Database & Repositories | Connection validation, schema constraints, zero-garbage insertion policy. |
| `npm run test:scraper` | Scraper Reliability | 17 failure modes: slow responses, HTTP 500/404, timeouts, missing price/stock, anti-bot dwell failure, retries, changed DOM structure. |
| `npm run test:api` | REST API | 65 tests verifying status codes, UUID validation, error structures, search, and CRUD. |
| `npm run test:scheduled` | Scheduled Batch Scrape | 14 tests verifying `CRON_SECRET` auth, concurrency protection (`409 Conflict`), partial failure isolation, and manual CLI execution. |

---

## Running the Scraper

### Normal / Headless Execution
By default, all scrapers run in headless Chromium mode to minimize memory consumption:
- Triggered on-demand via the UI **"Scrape Now"** button (`POST /api/tracked-products/:id/scrape`).
- Triggered automatically via scheduled cron jobs (`POST /api/scrape/run`).
- Triggered manually via CLI:
  ```bash
  npm run scrape:batch
  # OR
  cd backend && npm run scrape:run
  ```

---

## Headed Scraper Demo

To record or observe the scraper interacting with the live INE storefront in real time, a dedicated headed script is provided. It launches a visible Chromium browser with an on-screen red indicator following simulated mouse trajectories:

```bash
# Run the headed scraper against the first tracked product:
npm run scrape:headed
```

### Demonstrating Retry Behavior (Controlled Failure Simulation)
To prove that the scraper handles transient failures and executes bounded retries with backoff, run with the `--simulate-failure` flag:

```bash
npm run scrape:headed -- --simulate-failure
```

**What this demonstrates:**
1. **Visible Browser**: Playwright launches a visible Chromium window (`slowMo: 250ms`).
2. **First Attempt (Failure)**: Simulates a transient network drop on attempt 1.
3. **Audit Log & Backoff**: Logs the failure as `retried` and pauses for backoff delay ($1500\text{ms}$).
4. **Second Attempt (Success)**: Re-engages the page, navigates to the item, simulates 10 mouse movements across `.price-block`, pauses for the required $650\text{ms}$ dwell period, and clicks the reveal trigger.
5. **Data Extraction**: Extracts verified selling price (ignoring strikethrough decoys) and stock level.
6. **Persistence**: Saves the observation into `price_history` and writes a `success` record to `scrape_logs`.

---

## Scraping Reliability

### 1. Timeout Handling
The scraper uses tiered timeouts to avoid hanging indefinitely:
- **Page Navigation (`page.goto`)**: 30 seconds (`domcontentloaded`).
- **Container Discovery (`.price-block`)**: 15 seconds.
- **Price Reveal Mutation (`.price-success`)**: 10 seconds.
- **Stock Badge (`.stock-badge`)**: 5 seconds.

### 2. Bounded Retries & Exponential Backoff
- Maximum attempts per scrape: **3** (`MAX_ATTEMPTS = 3`).
- The scraper **never loops infinitely**.
- Backoff between retries: Linear/exponential backoff formula:
  $$\text{Delay} = \text{attempt} \times 1500\text{ms}$$
  *(Attempt 1 $\to$ 1.5s wait $\to$ Attempt 2 $\to$ 3.0s wait $\to$ Attempt 3)*.

### 3. Asynchronous Content & Anti-Bot Heuristics
- The storefront's client-side script monitors mouse interactions via a protection class (`Ar`) on the price reveal button.
- Direct clicks without mouse movement leave the button disabled.
- The extractor generates **10 discrete mouse coordinates** across `.price-block` with $45\text{ms}$ pauses, followed by a minimum **$650\text{ms}$ dwell time** before triggering the click event.

### 4. Strict Validation & Invalid-Data Protection
- **Decoy Rejection**: The storefront markup contains decoy spans and strikethrough MSRP values. The extractor filters out elements containing `line-through` styles or percentage discounts, isolating the true price.
- **Zero-Garbage Policy**: The `validator.js` layer enforces that extracted values are strictly valid:
  - Price must be a finite positive number ($P > 0$).
  - Stock must be a non-negative integer ($S \ge 0$).
- If validation fails, `priceHistoryRepository` refuses insertion and throws an error.
- **Old History Preserved**: If a scrape fails, existing valid historical price points remain unchanged; only the product's `last_scrape_status` is updated to `'failed'`.

### 5. Honest Scrape Audit Logging
- Every single attempt (success, retry, or final failure) is recorded in `scrape_logs`.
- Failures are never hidden or disguised as successes.
- Fields logged include `attempt_number`, `duration_ms`, `error_type`, `error_message`, and `engine`.

### 6. Deterministic Change Detection
- If the storefront markup shifts (e.g., `.price-block` is renamed or missing), the scraper throws a custom `StructureChangeError`.
- The system categorizes this as `error_type = 'STRUCTURE_CHANGED'` in `scrape_logs`, providing diagnostic details (`failedSelector`, `missingField`, `pageTitle`, `url`).
- Missing fields are **never silently interpreted as zero**.

---

## Scheduling

Production scheduling must not rely on an in-process `setInterval` loop because hosting environments (such as Render free-tier or serverless instances) spin down during idle periods, resetting memory state and killing timers.

### 2-Hour Schedule via `cron-job.org`

Scheduled scraping is triggered externally via an authenticated webhook:

| Setting | Configuration |
|---|---|
| **Target URL** | `https://<your-render-backend>.onrender.com/api/scrape/run` |
| **HTTP Method** | `POST` |
| **Schedule** | Every 2 hours (`0 */2 * * *`) |
| **Authentication Header** | `Authorization: Bearer <CRON_SECRET>` *(or `x-cron-secret: <CRON_SECRET>`)* |
| **Request Timeout** | `60 seconds` |

### Key Guarantees:
1. **Fault Isolation**: Active products are scraped sequentially. If product #2 fails, products #3 and #4 continue scraping normally.
2. **Re-entrancy Protection**: If a batch job is already executing, duplicate concurrent requests return `409 Conflict` with `{ inProgress: true }` to prevent process overloading.
3. **Execution Summary**: Returns a comprehensive summary payload:
   ```json
   {
     "success": true,
     "summary": {
       "total": 5,
       "successful": 4,
       "failed": 1,
       "duration_ms": 14230
     },
     "results": [...]
   }
   ```

---

## API Endpoints

All API endpoints return consistent JSON responses. Base route: `/api`.

### 1. Health Check
- **`GET /api/health`**
  - **Description**: Returns system health, database connectivity mode, and timestamp.
  - **Status Codes**: `200 OK`.

### 2. Product Catalog Search
- **`GET /api/products/search?q=<query>`**
  - **Description**: Searches the remote INE storefront for products matching the query string.
  - **Validation**: Requires `q` parameter (minimum 1 character).
  - **Status Codes**: `200 OK`, `400 Bad Request`, `502 Bad Gateway`.

### 3. Tracked Products
- **`POST /api/tracked-products`**
  - **Description**: Adds a product to the tracking dashboard.
  - **Body**: `{ "externalStoreId": 101, "name": "Wireless Mouse", "storeUrl": "https://..." }`
  - **Status Codes**: `201 Created`, `400 Bad Request`, `409 Conflict` (if already tracked).
- **`GET /api/tracked-products`**
  - **Description**: Lists tracked products. Optional query: `?status=active|paused|all`.
  - **Status Codes**: `200 OK`.
- **`GET /api/tracked-products/:id`**
  - **Description**: Retrieves single tracked product by UUID.
  - **Status Codes**: `200 OK`, `400 Bad Request` (invalid UUID), `404 Not Found`.

### 4. Product Price History & Audit Logs
- **`GET /api/tracked-products/:id/history?limit=100`**
  - **Description**: Retrieves chronologically ordered price and stock observations for chart visualization.
  - **Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`.
- **`GET /api/tracked-products/:id/logs?limit=50&offset=0`**
  - **Description**: Retrieves paginated audit logs of all scrape attempts (latest first).
  - **Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`.

### 5. Scrape Execution Triggers
- **`POST /api/tracked-products/:id/scrape`**
  - **Description**: Manually triggers an immediate single-product scrape.
  - **Status Codes**: `200 OK`, `400 Bad Request`, `404 Not Found`, `502 Bad Gateway` (scrape failure).
- **`POST /api/scrape/run`**
  - **Description**: Batch triggers a scheduled scrape of all active tracked products.
  - **Authentication**: Requires `Bearer <CRON_SECRET>` or `x-cron-secret` header.
  - **Status Codes**: `200 OK`, `401 Unauthorized`, `409 Conflict` (run already in progress).

---

## Deployment

The application is structured for deployment across Vercel, Render, and Supabase:

### 1. Database: Supabase
1. Create a Supabase project.
2. Run `backend/src/db/schema.sql` in the **SQL Editor**.
3. Copy the **Project URL** and **Service Role Secret** from *Project Settings > API*.

### 2. Backend: Render
1. Create a **New Web Service** pointing to your repository.
2. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx playwright install chromium --with-deps`
   - **Start Command**: `npm start`
3. Configure Environment Variables:
   - `NODE_ENV`: `production`
   - `CORS_ORIGIN`: `https://<your-vercel-app>.vercel.app`
   - `SUPABASE_URL`: `<your-supabase-url>`
   - `SUPABASE_SERVICE_ROLE_KEY`: `<your-supabase-service-role-key>`
   - `CRON_SECRET`: `<generate-a-secure-random-secret>`

### 3. Frontend: Vercel
1. Create a **New Project** in Vercel.
2. Configure settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Configure Environment Variables:
   - `VITE_API_URL`: `https://<your-render-backend>.onrender.com/api`

---

## Design Decisions

### HTTP Parsing vs. Playwright Automation

| Capability | Catalog Search (`catalogService.js`) | Product Price & Stock Scraping (`extractor.js`) |
|---|---|---|
| **Mechanism** | Lightweight HTTP request (`fetch`) + HTML parsing | Full browser automation (Playwright Chromium) |
| **Why this choice?** | The search results endpoint on the storefront returns static server-rendered HTML. Using a lightweight HTTP client avoids browser startup overhead, delivers **< 100ms response times**, and consumes virtually zero server RAM. | The product detail page employs client-side JavaScript and bot-detection heuristics (`Ar` class). The price is hidden behind a button requiring **$\ge 8$ cursor movements and $\ge 600\text{ms}$ dwell time**. A static HTTP fetch only sees a disabled placeholder. Playwright is required to emulate human interaction and extract rendered prices. |

---

## Known Limitations

In the interest of full technical transparency, the following limitations exist in the current architecture:

1. **Sequential Single-Worker Batch Scraping**: The scheduled scrape endpoint (`POST /api/scrape/run`) processes active tracked products one after another. While this avoids overwhelming host memory (critical on 512MB free tiers), scaling to thousands of tracked products would require an asynchronous job queue (e.g., BullMQ + Redis worker pool).
2. **Render Free-Tier Cold Starts**: On free hosting tiers, idle backend services sleep after 15 minutes. The first incoming request from a user or `cron-job.org` may experience a 30–50 second spin-up delay.
3. **Chromium Memory Footprint**: Headless Chromium instances typically consume 150–250MB RAM during page interactions. The backend mitigates this by enforcing re-entrancy locks and coalescing duplicate requests, but running concurrent headless scrapers on low-memory servers must be carefully managed.
4. **In-Memory Store Volatility**: When running without Supabase credentials, the backend falls back to an in-memory repository for zero-dependency development. Any data accumulated in this mode is lost when the server restarts.
5. **Target Storefront Specificity**: The extraction logic is tailored to the markup patterns and anti-bot heuristics of the INE mock storefront (`demo.inelabteamdev.com`). While structural changes trigger clear alerts via `StructureChangeError`, tracking commercial third-party e-commerce sites would require site-specific selector adapters or a dynamic extraction engine.

---

## License

ISC License. Built for the INE Software Engineer Intern Technical Assignment.
