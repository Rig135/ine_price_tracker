import http from 'http';

/**
 * Controlled mock storefront server for simulating unreliable external system scenarios.
 */
export class MockStorefrontServer {
  constructor() {
    this.server = null;
    this.port = null;
    this.flakyAttempts = 0;
    this.requestCounts = {};
  }

  async start(port = 0) {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(port, () => {
        this.port = this.server.address().port;
        resolve(this.port);
      });
      this.server.on('error', reject);
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getBaseUrl() {
    return `http://127.0.0.1:${this.port}`;
  }

  resetStats() {
    this.flakyAttempts = 0;
    this.requestCounts = {};
  }

  handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    this.requestCounts[pathname] = (this.requestCounts[pathname] || 0) + 1;

    // 1. Successful scrape
    if (pathname === '/product/success' || pathname === '/product/101') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(this.renderPage({
        priceText: '$79.99',
        stockText: 'In Stock (18)'
      }));
    }

    // 2. Slow response (delays response by 1200ms, then succeeds)
    if (pathname === '/product/slow') {
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.renderPage({
            priceText: '$149.00',
            stockText: 'In Stock (5)'
          }));
        }
      }, 1200);
      return;
    }

    // 3. Request timeout (never sends response, socket hangs)
    if (pathname === '/product/timeout') {
      // Do not respond; let the client timeout
      return;
    }

    // 4. HTTP 500 Internal Server Error
    if (pathname === '/product/500') {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Internal Server Error (Simulated 500)');
    }

    // 5. HTTP 404 Not Found
    if (pathname === '/product/404') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Product Not Found (Simulated 404)');
    }

    // 6. Temporary network failure (socket reset)
    if (pathname === '/product/network-fail') {
      req.socket.destroy();
      return;
    }

    // 7. Missing price
    if (pathname === '/product/missing-price') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(this.renderPage({
        omitPrice: true,
        stockText: 'In Stock (10)'
      }));
    }

    // 8. Missing stock
    if (pathname === '/product/missing-stock') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(this.renderPage({
        priceText: '$59.99',
        omitStock: true
      }));
    }

    // 9. Changed / unexpected selector
    if (pathname === '/product/changed-selector') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(this.renderPage({
        priceText: '$99.99',
        stockText: 'In Stock (20)',
        priceBlockClass: 'unexpected-pricing-container'
      }));
    }

    // 10. Malformed product data
    if (pathname === '/product/malformed-data') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(this.renderPage({
        priceText: '$0.00',
        stockText: 'In Stock (-5)'
      }));
    }

    // 11. Flaky: Fail on attempt 1 with HTTP 500, succeed on attempt 2
    if (pathname === '/product/flaky') {
      this.flakyAttempts++;
      if (this.flakyAttempts === 1) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Flaky error on attempt 1');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(this.renderPage({
        priceText: '$120.50',
        stockText: 'In Stock (7)'
      }));
    }

    // 12. Always fail (all retries fail)
    if (pathname === '/product/always-fail') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      return res.end('Service Temporarily Unavailable (503)');
    }

    // 13. Changed reveal structure (after click, selector is .changed-price-display instead of .price-success)
    if (pathname === '/product/changed-reveal-structure') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(this.renderPage({
        priceText: '$88.50',
        stockText: 'In Stock (14)',
        priceSuccessClass: 'changed-price-display'
      }));
    }

    // 14. Changed stock selector (.changed-inventory-tag instead of .stock-badge)
    if (pathname === '/product/changed-stock-selector') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(this.renderPage({
        priceText: '$65.00',
        stockText: 'In Stock (14)',
        stockBadgeClass: 'changed-inventory-tag'
      }));
    }

    // 15. Redesigned page (completely different layout/classes)
    if (pathname === '/product/redesigned-page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<!DOCTYPE html>
<html>
<head><title>New Redesigned Storefront</title></head>
<body>
  <div class="product-hero-v2">
    <h1>Redesigned Wireless Headphones</h1>
    <div class="product-price-v2">₹4,999</div>
    <div class="availability-status">24 units ready to ship</div>
  </div>
</body>
</html>`);
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  renderPage({
    priceText = '$49.99',
    stockText = 'In Stock (12)',
    omitPrice = false,
    omitStock = false,
    priceBlockClass = 'price-block',
    priceSuccessClass = 'price-success',
    stockBadgeClass = 'stock-badge'
  } = {}) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mock Store Product</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .${priceBlockClass} { padding: 15px; border: 1px solid #ccc; width: 220px; cursor: pointer; text-align: center; }
    .${stockBadgeClass} { margin-top: 10px; display: inline-block; padding: 4px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; }
    .${priceSuccessClass} { font-size: 24px; font-weight: bold; color: #16a34a; }
  </style>
</head>
<body>
  <h1>Test Product</h1>
  <div class="${priceBlockClass}" id="price-container">
    <button id="reveal-btn">Reveal price</button>
  </div>
  ${!omitStock ? `<div class="${stockBadgeClass}">${stockText}</div>` : ''}

  <script>
    const container = document.getElementById('price-container');
    const revealBtn = document.getElementById('reveal-btn');
    
    function reveal() {
      if (${omitPrice}) {
        container.innerHTML = '<span>Price unavailable</span>';
      } else {
        container.innerHTML = '<span class="${priceSuccessClass}">${priceText}</span>';
      }
    }

    if (revealBtn) {
      revealBtn.addEventListener('click', reveal);
    }
    if (container) {
      container.addEventListener('click', reveal);
    }
  </script>
</body>
</html>`;
  }
}
