import React, { useState, useMemo } from 'react';
import {
  formatLocalTimestamp,
  formatUtcTimestamp,
  getLocalTimezoneName,
  getLocalTimezoneAbbr
} from '../utils/dateTime';

/**
 * Price & Stock History Visualization Component
 * 
 * Strict Guarantees:
 * 1. Price over time & Stock over time.
 * 2. Timestamps clearly displayed with consistent local timezone + UTC transparency.
 * 3. Fallback table sorted with NEWEST data first.
 * 4. Distinguishes missing data from 0 (stock === 0 vs stock === null).
 * 5. Does NOT interpolate values between sparse scrapes (straight segments, discrete nodes).
 * 6. Failed scrapes are strictly segregated in the Audit Log and NEVER plotted as fake price points.
 */
export function HistoryVisualization({ history = [], currency = '₹' }) {
  const [viewMetric, setViewMetric] = useState('both'); // 'both' | 'price' | 'stock'
  const [displayMode, setDisplayMode] = useState('both'); // 'both' (chart + table) | 'chart' | 'table'
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Chronological sort for chart rendering (oldest -> newest, left -> right)
  const chronological = useMemo(() => {
    return [...history].sort((a, b) => new Date(a.scraped_at) - new Date(b.scraped_at));
  }, [history]);

  // Newest-first sort for debugging table (newest -> oldest, top -> bottom)
  const newestFirst = useMemo(() => {
    return [...history].sort((a, b) => new Date(b.scraped_at) - new Date(a.scraped_at));
  }, [history]);

  // Empty state handling
  if (!history || history.length === 0) {
    return (
      <div className="history-empty-card card text-center py-5">
        <span className="empty-icon mb-2">📈</span>
        <h3>No Price or Stock History Recorded</h3>
        <p className="text-secondary mb-3">
          No verified scrapes exist for this product yet. Trigger a scrape above to log the first valid price & stock observation.
        </p>
        <div className="alert alert-info py-2 px-3 inline-block text-small">
          ℹ️ Failed scrapes are recorded in the Scrape Audit Trail below and will never generate fake price/stock history.
        </div>
      </div>
    );
  }

  // Calculate statistics across verified observations
  const validPrices = chronological.map((h) => Number(h.price)).filter((p) => !isNaN(p) && p > 0);
  const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
  const maxPrice = validPrices.length ? Math.max(...validPrices) : 0;
  const latestPrice = validPrices.length ? validPrices[validPrices.length - 1] : null;
  const initialPrice = validPrices.length ? validPrices[0] : null;
  const priceDelta = latestPrice !== null && initialPrice !== null ? latestPrice - initialPrice : 0;

  // Stock calculations (strictly separating 0 from null/undefined)
  const stockCounts = chronological
    .map((h) => (h.stock !== null && h.stock !== undefined ? Number(h.stock) : null))
    .filter((s) => s !== null && !isNaN(s));
  const minStock = stockCounts.length ? Math.min(...stockCounts) : 0;
  const maxStock = stockCounts.length ? Math.max(...stockCounts) : 0;

  // Chart layout configuration
  const width = 740;
  const height = 250;
  const padding = { top: 30, right: 65, bottom: 45, left: 65 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Scaling helpers
  const count = chronological.length;
  const getX = (idx) => {
    if (count <= 1) return padding.left + innerWidth / 2;
    return padding.left + (idx / (count - 1)) * innerWidth;
  };

  const priceRange = maxPrice - minPrice || (maxPrice > 0 ? maxPrice * 0.1 : 1);
  const getYPrice = (val) => {
    if (val === null || val === undefined || isNaN(val)) return null;
    return padding.top + innerHeight - ((val - minPrice) / priceRange) * innerHeight;
  };

  // Stock Y-scale: minimum scale baseline is always 0 to clearly show when stock is 0
  const stockScaleMax = Math.max(maxStock, 5);
  const getYStock = (val) => {
    if (val === null || val === undefined || isNaN(val)) return null;
    return padding.top + innerHeight - (val / stockScaleMax) * innerHeight;
  };

  // SVG Points Generator (Do NOT interpolate missing values; straight lines only)
  const pricePoints = chronological
    .map((item, i) => {
      const y = getYPrice(Number(item.price));
      return y !== null ? `${getX(i)},${y}` : null;
    })
    .filter(Boolean)
    .join(' ');

  const stockPoints = chronological
    .map((item, i) => {
      const val = item.stock !== null && item.stock !== undefined ? Number(item.stock) : null;
      const y = getYStock(val);
      return y !== null ? `${getX(i)},${y}` : null;
    })
    .filter(Boolean)
    .join(' ');

  const tzName = getLocalTimezoneName();
  const tzAbbr = getLocalTimezoneAbbr();

  return (
    <div className="history-visualization-wrapper">
      {/* Top Controls: View Switcher, Metric Filter & Timezone Badge */}
      <div className="vis-controls-header">
        <div className="vis-metric-filters" role="group" aria-label="Metric toggles">
          <button
            type="button"
            className={`btn btn-xs ${viewMetric === 'both' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMetric('both')}
          >
            Dual: Price & Stock
          </button>
          <button
            type="button"
            className={`btn btn-xs ${viewMetric === 'price' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMetric('price')}
          >
            Price Only
          </button>
          <button
            type="button"
            className={`btn btn-xs ${viewMetric === 'stock' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMetric('stock')}
          >
            Stock Only
          </button>
        </div>

        <div className="vis-right-controls">
          <span className="badge badge-tz" title={`Local timezone: ${tzName}`}>
            🕒 {tzAbbr || tzName} (Local)
          </span>

          <div className="vis-mode-toggle">
            <button
              type="button"
              className={`btn btn-xs ${displayMode === 'both' ? 'btn-active-mode' : 'btn-ghost'}`}
              onClick={() => setDisplayMode('both')}
              title="Show chart and table"
            >
              Chart & Table
            </button>
            <button
              type="button"
              className={`btn btn-xs ${displayMode === 'chart' ? 'btn-active-mode' : 'btn-ghost'}`}
              onClick={() => setDisplayMode('chart')}
              title="Show chart only"
            >
              Chart Only
            </button>
            <button
              type="button"
              className={`btn btn-xs ${displayMode === 'table' ? 'btn-active-mode' : 'btn-ghost'}`}
              onClick={() => setDisplayMode('table')}
              title="Show fallback table only"
            >
              Table Only
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="vis-summary-pills">
        <div className="stat-pill">
          <span className="stat-pill-label">Lowest Price:</span>
          <span className="stat-pill-val">{currency}{minPrice.toFixed(2)}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Highest Price:</span>
          <span className="stat-pill-val">{currency}{maxPrice.toFixed(2)}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Latest Price:</span>
          <span className="stat-pill-val text-accent">
            {latestPrice !== null ? `${currency}${latestPrice.toFixed(2)}` : 'N/A'}
          </span>
          {priceDelta !== 0 && (
            <span className={`pill-delta ${priceDelta < 0 ? 'text-success' : 'text-danger'}`}>
              ({priceDelta < 0 ? '↓' : '↑'} {currency}{Math.abs(priceDelta).toFixed(2)})
            </span>
          )}
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Stock Range:</span>
          <span className="stat-pill-val">
            {minStock === 0 ? <strong className="text-warning">0</strong> : minStock} – {maxStock} units
          </span>
        </div>
        <div className="stat-pill pill-legend">
          {(viewMetric === 'both' || viewMetric === 'price') && (
            <span className="legend-item text-cyan">● Price ({currency})</span>
          )}
          {(viewMetric === 'both' || viewMetric === 'stock') && (
            <span className="legend-item text-emerald">■ Stock (Units)</span>
          )}
        </div>
      </div>

      {/* Chart Section */}
      {displayMode !== 'table' && (
        <div className="vis-chart-container">
          {count === 1 ? (
            <div className="single-observation-banner">
              <span className="single-pill">1 Verified Observation</span>
              <p className="text-secondary text-small mt-1">
                Recorded on <strong>{formatLocalTimestamp(chronological[0].scraped_at)}</strong> (
                {formatUtcTimestamp(chronological[0].scraped_at)}) · Price: <strong>{currency}{Number(chronological[0].price).toFixed(2)}</strong> · Stock: <strong>{chronological[0].stock} units</strong>
              </p>
            </div>
          ) : (
            <div className="svg-chart-box">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="history-svg-canvas"
                aria-label="Price and Stock trend chart"
              >
                <defs>
                  <linearGradient id="priceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="stockAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines */}
                <line
                  x1={padding.left}
                  y1={padding.top}
                  x2={width - padding.right}
                  y2={padding.top}
                  className="chart-grid-line"
                />
                <line
                  x1={padding.left}
                  y1={padding.top + innerHeight / 2}
                  x2={width - padding.right}
                  y2={padding.top + innerHeight / 2}
                  className="chart-grid-line"
                />
                <line
                  x1={padding.left}
                  y1={padding.top + innerHeight}
                  x2={width - padding.right}
                  y2={padding.top + innerHeight}
                  className="chart-grid-baseline"
                />

                {/* Left Y-Axis: Price Labels (Cyan) */}
                {(viewMetric === 'both' || viewMetric === 'price') && (
                  <g className="y-axis-price">
                    <text
                      x={padding.left - 10}
                      y={padding.top + 4}
                      className="axis-label-price"
                      textAnchor="end"
                    >
                      {currency}{maxPrice.toFixed(0)}
                    </text>
                    <text
                      x={padding.left - 10}
                      y={padding.top + innerHeight / 2 + 4}
                      className="axis-label-price"
                      textAnchor="end"
                    >
                      {currency}{((maxPrice + minPrice) / 2).toFixed(0)}
                    </text>
                    <text
                      x={padding.left - 10}
                      y={padding.top + innerHeight + 4}
                      className="axis-label-price"
                      textAnchor="end"
                    >
                      {currency}{minPrice.toFixed(0)}
                    </text>
                  </g>
                )}

                {/* Right Y-Axis: Stock Labels (Emerald) */}
                {(viewMetric === 'both' || viewMetric === 'stock') && (
                  <g className="y-axis-stock">
                    <text
                      x={width - padding.right + 10}
                      y={padding.top + 4}
                      className="axis-label-stock"
                      textAnchor="start"
                    >
                      {stockScaleMax}u
                    </text>
                    <text
                      x={width - padding.right + 10}
                      y={padding.top + innerHeight / 2 + 4}
                      className="axis-label-stock"
                      textAnchor="start"
                    >
                      {Math.round(stockScaleMax / 2)}u
                    </text>
                    <text
                      x={width - padding.right + 10}
                      y={padding.top + innerHeight + 4}
                      className="axis-label-stock"
                      textAnchor="start"
                    >
                      0u
                    </text>
                  </g>
                )}

                {/* Stock Trendline & Area */}
                {(viewMetric === 'both' || viewMetric === 'stock') && (
                  <>
                    <polyline
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      strokeDasharray={viewMetric === 'both' ? '4 3' : 'none'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={stockPoints}
                    />
                  </>
                )}

                {/* Price Trendline & Gradient Area */}
                {(viewMetric === 'both' || viewMetric === 'price') && (
                  <>
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pricePoints}
                    />
                  </>
                )}

                {/* Discrete Data Point Nodes (Strict: No interpolated nodes) */}
                {chronological.map((item, i) => {
                  const cx = getX(i);
                  const cyPrice = getYPrice(Number(item.price));
                  const cyStock = getYStock(
                    item.stock !== null && item.stock !== undefined ? Number(item.stock) : null
                  );
                  const isHovered = hoveredIdx === i;

                  return (
                    <g key={item.id || i} className="observation-node-group">
                      {/* Price Node */}
                      {(viewMetric === 'both' || viewMetric === 'price') && cyPrice !== null && (
                        <circle
                          cx={cx}
                          cy={cyPrice}
                          r={isHovered ? 6 : 4}
                          className="node-price"
                          onMouseEnter={() => setHoveredIdx(i)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        />
                      )}

                      {/* Stock Node: Note special indicator if stock === 0 vs normal vs missing */}
                      {(viewMetric === 'both' || viewMetric === 'stock') && cyStock !== null && (
                        <rect
                          x={cx - (isHovered ? 5 : 3.5)}
                          y={cyStock - (isHovered ? 5 : 3.5)}
                          width={isHovered ? 10 : 7}
                          height={isHovered ? 10 : 7}
                          className={item.stock === 0 ? 'node-stock-zero' : 'node-stock'}
                          onMouseEnter={() => setHoveredIdx(i)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        />
                      )}

                      {/* Interactive Hover Card */}
                      {isHovered && (
                        <g className="chart-tooltip-group" pointerEvents="none">
                          <line
                            x1={cx}
                            y1={padding.top}
                            x2={cx}
                            y2={padding.top + innerHeight}
                            className="chart-hover-guide"
                          />
                          <rect
                            x={Math.min(Math.max(cx - 100, 10), width - 210)}
                            y={Math.max(2, (cyPrice || cyStock || 60) - 75)}
                            width="200"
                            height="68"
                            rx="6"
                            className="tooltip-box"
                          />
                          <text
                            x={Math.min(Math.max(cx - 100, 10) + 10, width - 200)}
                            y={Math.max(2, (cyPrice || cyStock || 60) - 75) + 16}
                            className="tooltip-title"
                          >
                            {formatLocalTimestamp(item.scraped_at, { includeSeconds: false })}
                          </text>
                          <text
                            x={Math.min(Math.max(cx - 100, 10) + 10, width - 200)}
                            y={Math.max(2, (cyPrice || cyStock || 60) - 75) + 33}
                            className="tooltip-body text-cyan"
                          >
                            Price: {currency}{Number(item.price).toFixed(2)}
                          </text>
                          <text
                            x={Math.min(Math.max(cx - 100, 10) + 10, width - 200)}
                            y={Math.max(2, (cyPrice || cyStock || 60) - 75) + 50}
                            className={`tooltip-body ${item.stock === 0 ? 'text-warning' : 'text-emerald'}`}
                          >
                            Stock: {item.stock !== null && item.stock !== undefined ? (
                              item.stock === 0 ? '0 units (OUT OF STOCK)' : `${item.stock} units`
                            ) : (
                              'Missing Data'
                            )}
                          </text>
                          <text
                            x={Math.min(Math.max(cx - 100, 10) + 10, width - 200)}
                            y={Math.max(2, (cyPrice || cyStock || 60) - 75) + 64}
                            className="tooltip-utc"
                          >
                            {formatUtcTimestamp(item.scraped_at)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* X-Axis Timeline Labels */}
                <text
                  x={padding.left}
                  y={height - 10}
                  className="chart-axis-text"
                  textAnchor="start"
                >
                  {formatLocalTimestamp(chronological[0].scraped_at, { includeSeconds: false })}
                </text>
                <text
                  x={width - padding.right}
                  y={height - 10}
                  className="chart-axis-text"
                  textAnchor="end"
                >
                  {formatLocalTimestamp(chronological[count - 1].scraped_at, { includeSeconds: false })}
                </text>
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Fallback & Debugging Table (Strict Requirement: Newest Data First) */}
      {displayMode !== 'chart' && (
        <div className="vis-table-container">
          <div className="vis-table-header-row">
            <div>
              <h4 className="table-heading">📋 Observations History Table (Debugging Fallback)</h4>
              <p className="text-secondary text-small">
                Chronological audit table. <strong>Newest observations appear first</strong> for debugging recent scrape adjustments.
              </p>
            </div>
            <div className="table-badge-group">
              <span className="badge badge-sort">▼ Newest First</span>
              <span className="badge badge-verified">🛡️ Verified Scrapes Only</span>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table" aria-label="Verified Price and Stock Observations">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>#</th>
                  <th>Observation Time ({tzAbbr || 'Local'})</th>
                  <th>UTC Timestamp</th>
                  <th>Observed Price</th>
                  <th>Observed Stock</th>
                  <th>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((item, idx) => {
                  const seqNum = newestFirst.length - idx; // 1-indexed historical sequence
                  const isStockZero = item.stock === 0;
                  const isStockMissing = item.stock === null || item.stock === undefined;
                  const isPriceMissing = item.price === null || item.price === undefined;

                  return (
                    <tr key={item.id || idx}>
                      <td className="text-secondary text-small">{seqNum}</td>
                      <td>
                        <strong>{formatLocalTimestamp(item.scraped_at)}</strong>
                      </td>
                      <td className="text-secondary text-small font-mono">
                        {formatUtcTimestamp(item.scraped_at)}
                      </td>
                      <td>
                        {isPriceMissing ? (
                          <span className="badge badge-missing">Missing</span>
                        ) : (
                          <span className="text-accent font-weight-bold">
                            {currency}{Number(item.price).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td>
                        {isStockMissing ? (
                          <span className="badge badge-missing">Missing Data</span>
                        ) : isStockZero ? (
                          <span className="text-warning font-weight-bold">0 units</span>
                        ) : (
                          <span>{item.stock} units</span>
                        )}
                      </td>
                      <td>
                        {isStockMissing ? (
                          <span className="stock-pill stock-missing">Unobserved</span>
                        ) : isStockZero ? (
                          <span className="stock-pill out-of-stock">Out of Stock</span>
                        ) : (
                          <span className="stock-pill in-stock">In Stock</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
