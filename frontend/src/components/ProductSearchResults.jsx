import React from 'react';
import { ProductCard } from './ProductCard';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

export function ProductSearchResults({
  query = '',
  results = [],
  isLoading = false,
  error = null,
  trackedStoreIds = new Set(),
  trackingId = null,
  onTrack,
  onRetry
}) {
  if (isLoading) {
    return <LoadingState message={`Searching catalog for "${query}"...`} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Search Error"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  // Not searched yet or empty query
  if (!query && results.length === 0) {
    return (
      <div className="search-placeholder card">
        <p className="placeholder-text">
          Type a product name above (e.g. "air fryer", "laptop", "monitor") or enter a product ID to search the mock store catalog.
        </p>
      </div>
    );
  }

  // Empty search results state
  if (results.length === 0) {
    return (
      <div className="empty-results card" role="status">
        <div className="empty-icon">📦</div>
        <h3>No Products Found</h3>
        <p className="text-secondary">
          We couldn't find any products matching <strong>"{query}"</strong>.
        </p>
        <p className="text-small text-secondary">
          Try searching for a different keyword, brand (e.g. "Summit", "Auralite"), or category (e.g. "Kitchen", "Audio").
        </p>
      </div>
    );
  }

  return (
    <section className="search-results-section" aria-label="Search results">
      <div className="search-results-header">
        <h3 className="results-count">
          Found {results.length} matching {results.length === 1 ? 'product' : 'products'} for "{query}"
        </h3>
      </div>

      <div className="products-grid">
        {results.map((product) => {
          const isTracked = trackedStoreIds.has(product.external_store_id);
          const isTracking = trackingId === product.external_store_id;

          return (
            <ProductCard
              key={product.external_store_id}
              product={product}
              isTracked={isTracked}
              isTracking={isTracking}
              onTrack={onTrack}
            />
          );
        })}
      </div>
    </section>
  );
}
