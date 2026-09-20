import React from 'react';
import { TrackProductButton } from './TrackProductButton';

export function ProductCard({
  product,
  isTracked = false,
  isTracking = false,
  onTrack
}) {
  const { external_store_id, name, brand, category, sku, description, store_url } = product;

  return (
    <article className="product-card card" aria-labelledby={`product-title-${external_store_id}`}>
      <div className="product-card-header">
        <div className="product-badges">
          {category && <span className="badge badge-category">{category}</span>}
          {sku && <span className="badge badge-sku">SKU: {sku}</span>}
        </div>
        <span className="product-store-id">ID: #{external_store_id}</span>
      </div>

      <h3 id={`product-title-${external_store_id}`} className="product-title">
        {name}
      </h3>

      {brand && <p className="product-brand">Brand: <strong>{brand}</strong></p>}

      {description && <p className="product-description">{description}</p>}

      <div className="product-card-footer">
        {store_url && (
          <a
            href={store_url}
            target="_blank"
            rel="noopener noreferrer"
            className="store-link"
            title="Open product page on mock storefront"
          >
            View on Store ↗
          </a>
        )}

        <TrackProductButton
          isTracked={isTracked}
          isTracking={isTracking}
          onClick={() => onTrack(product)}
        />
      </div>
    </article>
  );
}
