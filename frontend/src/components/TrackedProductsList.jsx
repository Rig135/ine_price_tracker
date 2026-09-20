import React from 'react';

export function TrackedProductsList({
  products = [],
  isLoading = false,
  scrapingId = null,
  onScrape,
  onViewDetails
}) {
  if (isLoading) {
    return (
      <div className="card text-center py-5">
        <div className="spinner mx-auto mb-2" />
        <p className="text-secondary">Loading tracked products dashboard...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="card empty-tracked-card text-center py-5">
        <div className="empty-icon mb-2">📋</div>
        <h3>No Products Being Tracked</h3>
        <p className="text-secondary mb-3">
          Search the catalog above and click <strong>"+ Track Product"</strong> to monitor price and stock changes.
        </p>
      </div>
    );
  }

  return (
    <div className="tracked-grid" role="region" aria-label="Tracked products dashboard">
      {products.map((item) => {
        const isScraping = scrapingId === item.id;

        // Latest scrape status normalization
        const rawStatus = (item.last_scrape_status || 'pending').toLowerCase();
        let statusDisplay = 'PENDING';
        let statusBadgeClass = 'status-badge-pending';

        if (rawStatus === 'success') {
          statusDisplay = 'SUCCESS';
          statusBadgeClass = 'status-badge-success';
        } else if (rawStatus === 'retried' || rawStatus === 'retry') {
          statusDisplay = 'RETRY';
          statusBadgeClass = 'status-badge-retry';
        } else if (rawStatus === 'failed') {
          statusDisplay = 'FAILED';
          statusBadgeClass = 'status-badge-failed';
        }

        // Last successful scrape time (do not fabricate)
        const lastSuccessTime =
          item.last_price !== null && item.last_scraped_at
            ? new Date(item.last_scraped_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Never';

        return (
          <article key={item.id} className="card tracked-item-card">
            {/* Top Badges: Category, Tracking Status, and Latest Scrape Status */}
            <div className="tracked-card-top">
              <div className="badge-group">
                <span className="badge badge-category">{item.category || 'Product'}</span>
                <span className="badge badge-tracking">
                  {item.tracking_status === 'active' ? '● Active' : '○ Paused'}
                </span>
              </div>
              <span
                className={`status-badge ${statusBadgeClass}`}
                title={`Latest scrape outcome: ${statusDisplay}`}
              >
                {statusDisplay}
              </span>
            </div>

            {/* Product Title & Brand */}
            <h4 className="tracked-name">{item.name}</h4>
            <p className="tracked-meta text-secondary">
              {item.brand && <strong>{item.brand} · </strong>}
              <span>Store ID: #{item.external_store_id}</span>
              {item.sku && <span> · SKU: {item.sku}</span>}
            </p>

            {/* Key Metrics: Current Valid Price & Current Stock */}
            <div className="tracked-stats-row">
              <div className="stat-item">
                <span className="stat-label">Latest Known Price</span>
                <span className="stat-value text-accent">
                  {item.last_price !== null && item.last_price !== undefined
                    ? `₹${Number(item.last_price).toFixed(2)}`
                    : 'No quote yet'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Current Stock</span>
                <span className="stat-value">
                  {item.last_stock !== null && item.last_stock !== undefined
                    ? `${item.last_stock} units`
                    : 'Unknown'}
                </span>
              </div>
            </div>

            {/* Last Successful Scrape Time Callout */}
            <div className="last-success-row text-small text-secondary">
              <span>Last successful scrape:</span>
              <strong className={item.last_price !== null ? 'text-primary' : 'text-secondary'}>
                {lastSuccessTime}
              </strong>
            </div>

            {/* Card Actions: View Details / Link & Scrape Now */}
            <div className="tracked-footer">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => onViewDetails && onViewDetails(item.id)}
                aria-label={`View details and history for ${item.name}`}
              >
                View Details & History →
              </button>

              {onScrape && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => onScrape(item)}
                  disabled={isScraping}
                  title="Run scraper now"
                >
                  {isScraping ? 'Scraping...' : '⚡ Scrape'}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
