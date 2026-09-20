import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { HistoryVisualization } from './HistoryVisualization';
import { ScrapeLogsTable } from './ScrapeLogsTable';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { formatLocalTimestamp } from '../utils/dateTime';

export function ProductDetail({ productId, onBack }) {
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Manual scrape trigger state
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeFeedback, setScrapeFeedback] = useState(null);

  const loadProductData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [prodRes, histRes, logsRes] = await Promise.all([
        api.getTrackedProductById(productId),
        api.getProductHistory(productId),
        api.getProductLogs(productId)
      ]);

      if (prodRes.success && prodRes.data) {
        setProduct(prodRes.data);
      } else {
        throw new Error('Tracked product not found');
      }

      if (histRes.success && Array.isArray(histRes.data)) {
        setHistory(histRes.data);
      }

      if (logsRes.success && Array.isArray(logsRes.data)) {
        setLogs(logsRes.data);
      }
    } catch (err) {
      console.error('Failed to load product detail:', err);
      setError(err.message || 'Unable to load product details.');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  // Handle Manual Scrape
  const handleTriggerScrape = async () => {
    setIsScraping(true);
    setScrapeFeedback(null);

    try {
      const res = await api.triggerScrape(productId);
      if (res.success) {
        setScrapeFeedback({
          type: 'success',
          message: `✓ Scrape succeeded! Extracted Price: ₹${res.data.price}, Stock: ${res.data.stock}`
        });
      }
      await loadProductData();
    } catch (err) {
      setScrapeFeedback({
        type: 'error',
        message: `Scrape attempt failed: ${err.message}`
      });
      await loadProductData();
    } finally {
      setIsScraping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card product-detail-container">
        <LoadingState message="Loading product information and price history..." />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="card product-detail-container">
        <button type="button" className="btn btn-outline btn-sm back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <ErrorState
          title="Product Error"
          message={error || 'Product not found'}
          onRetry={loadProductData}
        />
      </div>
    );
  }

  // Derive last successful scrape timestamp from history (or product record)
  const lastSuccessfulScrape =
    history.length > 0
      ? formatLocalTimestamp(history[history.length - 1].scraped_at)
      : product.last_price !== null && product.last_scraped_at
      ? formatLocalTimestamp(product.last_scraped_at)
      : 'Never (no successful scrape yet)';

  // Determine latest scrape outcome badge
  const latestStatus = (product.last_scrape_status || 'pending').toUpperCase();
  const latestStatusClass =
    latestStatus === 'SUCCESS'
      ? 'status-badge-success'
      : latestStatus === 'RETRY' || latestStatus === 'RETRIED'
      ? 'status-badge-retry'
      : latestStatus === 'FAILED'
      ? 'status-badge-failed'
      : 'status-badge-pending';

  return (
    <div className="product-detail-view">
      {/* Top Navigation */}
      <div className="detail-top-nav">
        <button type="button" className="btn btn-outline btn-sm back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
      </div>

      {/* Scrape Feedback Alert */}
      {scrapeFeedback && (
        <div
          className={`alert alert-${scrapeFeedback.type === 'success' ? 'success' : 'error'} notification-banner`}
          role="status"
        >
          <span>{scrapeFeedback.message}</span>
          <button
            type="button"
            className="notification-close-btn"
            onClick={() => setScrapeFeedback(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Product Hero Header */}
      <section className="card detail-header-card">
        <div className="detail-header-main">
          <div className="detail-badges-row">
            {product.category && <span className="badge badge-category">{product.category}</span>}
            {product.sku && <span className="badge badge-sku">SKU: {product.sku}</span>}
            <span className="badge badge-tracking">Tracking: {product.tracking_status}</span>
          </div>

          <h2 className="detail-product-title">{product.name}</h2>

          <div className="detail-meta-row text-secondary">
            {product.brand && <span>Brand: <strong>{product.brand}</strong> · </span>}
            <span>Store ID: #{product.external_store_id}</span>
          </div>
        </div>

        <div className="detail-actions-col">
          {product.store_url && (
            <a
              href={product.store_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
              title="Open product on mock storefront"
            >
              View on Store ↗
            </a>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleTriggerScrape}
            disabled={isScraping}
          >
            {isScraping ? 'Scraping Live...' : '⚡ Trigger Scrape Now'}
          </button>
        </div>
      </section>

      {/* Key Metrics Grid */}
      <section className="detail-metrics-grid">
        {/* 1. Latest Valid Price */}
        <div className="card metric-card">
          <span className="metric-label">Latest Valid Price</span>
          <div className="metric-value-row">
            {product.last_price !== null && product.last_price !== undefined ? (
              <span className="metric-price-val text-accent">
                ₹{Number(product.last_price).toFixed(2)}
              </span>
            ) : (
              <span className="metric-empty-val text-secondary">
                No successful scrape yet
              </span>
            )}
          </div>
          <span className="metric-subtext text-secondary text-small">
            {product.last_price !== null ? 'Verified via scraper' : 'Awaiting first valid quote'}
          </span>
        </div>

        {/* 2. Latest Valid Stock */}
        <div className="card metric-card">
          <span className="metric-label">Latest Valid Stock</span>
          <div className="metric-value-row">
            {product.last_stock !== null && product.last_stock !== undefined ? (
              <span className="metric-stock-val">
                {product.last_stock} <small className="unit-text">units</small>
              </span>
            ) : (
              <span className="metric-empty-val text-secondary">
                Unknown
              </span>
            )}
          </div>
          <span className="metric-subtext text-secondary text-small">
            {product.last_stock !== null ? 'Live inventory level' : 'Stock not yet scraped'}
          </span>
        </div>

        {/* 3. Latest Scrape Outcome */}
        <div className="card metric-card">
          <span className="metric-label">Latest Scrape Outcome</span>
          <div className="metric-value-row">
            <span className={`status-badge ${latestStatusClass} large-badge`}>
              {latestStatus}
            </span>
          </div>
          <span className="metric-subtext text-secondary text-small">
            {product.last_scraped_at
              ? `Attempted: ${new Date(product.last_scraped_at).toLocaleTimeString()}`
              : 'No scrape runs yet'}
          </span>
        </div>

        {/* 4. Last Successful Scrape */}
        <div className="card metric-card">
          <span className="metric-label">Last Successful Scrape</span>
          <div className="metric-value-row">
            <span className="metric-time-val text-small">
              {lastSuccessfulScrape}
            </span>
          </div>
          <span className="metric-subtext text-secondary text-small">
            Total observations: {history.length}
          </span>
        </div>
      </section>

      {/* Price & Stock History Visualization (Chart & Debugging Fallback Table) */}
      <section className="card detail-chart-section">
        <div className="section-title-row">
          <h3 className="section-subtitle">📈 Price & Stock Trajectory History</h3>
          <span className="text-secondary text-small">{history.length} verified observations</span>
        </div>

        <HistoryVisualization history={history} currency="₹" />
      </section>

      {/* Transparent Audit Logs */}
      <section className="card detail-logs-section">
        <div className="section-title-row">
          <h3 className="section-subtitle">🛡️ Scrape Audit Trail (Attempts & Diagnostics)</h3>
          <span className="text-secondary text-small">{logs.length} logged attempts</span>
        </div>
        <p className="text-secondary text-small mb-3">
          Honest execution log. Retries and failures are permanently recorded without corrupting price data.
        </p>

        <ScrapeLogsTable logs={logs} />
      </section>
    </div>
  );
}
