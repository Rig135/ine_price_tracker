import React, { useState } from 'react';

export function PriceTrendChart({ history = [], currency = '₹' }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!history || history.length === 0) {
    return (
      <div className="chart-empty-state">
        <span className="empty-icon">📊</span>
        <p className="text-secondary">No price history recorded yet.</p>
        <p className="text-small text-secondary">
          Run a scrape to begin tracking price fluctuations over time.
        </p>
      </div>
    );
  }

  // Sort chronologically
  const sorted = [...history].sort((a, b) => new Date(a.scraped_at) - new Date(b.scraped_at));

  // Single observation case
  if (sorted.length === 1) {
    const single = sorted[0];
    return (
      <div className="chart-single-point card">
        <div className="single-point-badge">Single Observation</div>
        <div className="single-point-value">
          {currency}{Number(single.price).toFixed(2)}
        </div>
        <div className="single-point-meta text-secondary text-small">
          Recorded on {new Date(single.scraped_at).toLocaleString()} · Stock: {single.stock} units
        </div>
      </div>
    );
  }

  // Chart dimensions & scaling
  const width = 650;
  const height = 220;
  const padding = { top: 25, right: 35, bottom: 35, left: 55 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const prices = sorted.map((p) => Number(p.price));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1; // avoid division by zero if all prices equal

  const getX = (index) => padding.left + (index / (sorted.length - 1)) * innerWidth;
  const getY = (price) => padding.top + innerHeight - ((price - minPrice) / priceRange) * innerHeight;

  // Generate SVG path for line
  const points = sorted.map((item, i) => `${getX(i)},${getY(Number(item.price))}`).join(' ');
  const areaPath = `${points} ${getX(sorted.length - 1)},${padding.top + innerHeight} ${getX(0)},${padding.top + innerHeight}`;

  return (
    <div className="chart-wrapper">
      <div className="chart-header-stats">
        <div className="stat-pill">
          <span className="stat-pill-label">Lowest:</span>
          <span className="stat-pill-val">{currency}{minPrice.toFixed(2)}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Highest:</span>
          <span className="stat-pill-val">{currency}{maxPrice.toFixed(2)}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Latest:</span>
          <span className="stat-pill-val text-accent">
            {currency}{Number(sorted[sorted.length - 1].price).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="svg-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="price-svg-chart"
          aria-label="Price history trend chart"
        >
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background grid lines */}
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
            className="chart-grid-line"
          />

          {/* Y-Axis Labels */}
          <text x={padding.left - 8} y={padding.top + 4} className="chart-axis-text" textAnchor="end">
            {currency}{maxPrice.toFixed(0)}
          </text>
          <text x={padding.left - 8} y={padding.top + innerHeight / 2 + 4} className="chart-axis-text" textAnchor="end">
            {currency}{((maxPrice + minPrice) / 2).toFixed(0)}
          </text>
          <text x={padding.left - 8} y={padding.top + innerHeight + 4} className="chart-axis-text" textAnchor="end">
            {currency}{minPrice.toFixed(0)}
          </text>

          {/* Area under curve */}
          <polygon points={areaPath} fill="url(#priceGradient)" />

          {/* Trend Line */}
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Data Points */}
          {sorted.map((item, i) => {
            const cx = getX(i);
            const cy = getY(Number(item.price));
            const isHovered = hoveredPoint === i;

            return (
              <g key={item.id || i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  className="chart-dot"
                  onMouseEnter={() => setHoveredPoint(i)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {isHovered && (
                  <g className="chart-tooltip-group">
                    <rect
                      x={cx - 50}
                      y={cy - 34}
                      width="100"
                      height="26"
                      rx="4"
                      className="chart-tooltip-bg"
                    />
                    <text x={cx} y={cy - 17} className="chart-tooltip-text" textAnchor="middle">
                      {currency}{Number(item.price).toFixed(2)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* X-Axis Dates */}
          <text x={padding.left} y={height - 8} className="chart-axis-text" textAnchor="start">
            {new Date(sorted[0].scraped_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </text>
          <text x={width - padding.right} y={height - 8} className="chart-axis-text" textAnchor="end">
            {new Date(sorted[sorted.length - 1].scraped_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </text>
        </svg>
      </div>
    </div>
  );
}
