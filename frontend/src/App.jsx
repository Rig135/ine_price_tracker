import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { SearchBar } from './components/SearchBar';
import { ProductSearchResults } from './components/ProductSearchResults';
import { TrackedProductsList } from './components/TrackedProductsList';
import { ProductDetail } from './components/ProductDetail';
import { useHealth } from './hooks/useHealth';
import { api } from './api/client';

export function App() {
  const { health } = useHealth();

  // Navigation / Routing State (Hash-synchronized)
  const [selectedProductId, setSelectedProductId] = useState(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#\/product\/([a-zA-Z0-9-]+)$/);
    return match ? match[1] : null;
  });

  // Tracked Products Dashboard State
  const [trackedProducts, setTrackedProducts] = useState([]);
  const [isLoadingTracked, setIsLoadingTracked] = useState(true);
  const [trackingId, setTrackingId] = useState(null);
  const [scrapingId, setScrapingId] = useState(null);

  // Search Section State
  const [query, setQuery] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Feedback Notification
  const [notification, setNotification] = useState(null);

  // Listen to browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/product\/([a-zA-Z0-9-]+)$/);
      setSelectedProductId(match ? match[1] : null);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when selecting a product or going back
  const navigateToProduct = (id) => {
    window.location.hash = `#/product/${id}`;
    setSelectedProductId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToDashboard = () => {
    window.location.hash = '#/';
    setSelectedProductId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fast lookup set of tracked external_store_ids to prevent duplicate tracking
  const trackedStoreIds = useMemo(() => {
    return new Set(trackedProducts.map((p) => p.external_store_id));
  }, [trackedProducts]);

  // Load tracked products from API
  const fetchTrackedProducts = useCallback(async () => {
    try {
      setIsLoadingTracked(true);
      const res = await api.getTrackedProducts('all');
      if (res.success && Array.isArray(res.data)) {
        setTrackedProducts(res.data);
      }
    } catch (err) {
      console.error('Failed to load tracked products:', err);
    } finally {
      setIsLoadingTracked(false);
    }
  }, []);

  useEffect(() => {
    fetchTrackedProducts();
  }, [fetchTrackedProducts]);

  // Handle Search Submission
  const handleSearch = async (searchTerm) => {
    const term = (searchTerm || query).trim();
    if (!term) return;

    setActiveSearchTerm(term);
    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await api.searchProducts(term);
      if (response.success && Array.isArray(response.data)) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError(err.message || 'Failed to search store catalog. Please check your connection.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setActiveSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
  };

  // Handle Track Product Action
  const handleTrackProduct = async (product) => {
    if (trackedStoreIds.has(product.external_store_id)) {
      setNotification({
        type: 'info',
        message: `"${product.name}" is already being tracked.`
      });
      return;
    }

    setTrackingId(product.external_store_id);
    setNotification(null);

    try {
      const payload = {
        externalStoreId: product.external_store_id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        sku: product.sku,
        storeUrl: product.store_url,
        imageUrl: product.image_url
      };

      const res = await api.trackProduct(payload);

      if (res.success && res.data) {
        setTrackedProducts((prev) => [res.data, ...prev]);
        setNotification({
          type: 'success',
          message: `✓ Successfully added "${product.name}" to tracked products!`
        });
      }
    } catch (err) {
      console.error('Track error:', err);
      setNotification({
        type: 'error',
        message: `Failed to track product: ${err.message}`
      });
    } finally {
      setTrackingId(null);
    }
  };

  // Handle Manual Scrape Trigger on Card
  const handleScrapeProduct = async (product) => {
    setScrapingId(product.id);
    setNotification(null);

    try {
      const res = await api.triggerScrape(product.id);
      if (res.success) {
        setNotification({
          type: 'success',
          message: `✓ Scrape complete for "${product.name}": Price ₹${res.data.price}, Stock: ${res.data.stock}`
        });
        await fetchTrackedProducts();
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Scrape attempt failed: ${err.message}`
      });
      await fetchTrackedProducts();
    } finally {
      setScrapingId(null);
    }
  };

  return (
    <div className="app-container">
      <Navbar backendHealth={health} />

      <main className="main-content">
        {/* Global Notification Banner */}
        {notification && (
          <div
            className={`alert alert-${notification.type === 'success' ? 'success' : notification.type === 'error' ? 'error' : 'info'} notification-banner`}
            role="status"
          >
            <span className="notification-message">{notification.message}</span>
            <button
              type="button"
              className="notification-close-btn"
              onClick={() => setNotification(null)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        )}

        {/* View Switcher: Product Detail View vs Dashboard View */}
        {selectedProductId ? (
          <ProductDetail
            productId={selectedProductId}
            onBack={navigateToDashboard}
          />
        ) : (
          <>
            {/* Dashboard Section: Tracked Products Overview */}
            <section className="tracked-products-section">
              <div className="section-header-row">
                <div>
                  <div className="badge phase-badge">Phase 6 · Tracked Products Dashboard</div>
                  <h2 className="section-title">Tracked Products Overview</h2>
                  <p className="text-secondary text-small">
                    Monitoring {trackedProducts.length} {trackedProducts.length === 1 ? 'product' : 'products'} for live price and inventory updates.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={fetchTrackedProducts}
                  disabled={isLoadingTracked}
                >
                  {isLoadingTracked ? 'Refreshing...' : '↻ Refresh Dashboard'}
                </button>
              </div>

              <TrackedProductsList
                products={trackedProducts}
                isLoading={isLoadingTracked}
                scrapingId={scrapingId}
                onScrape={handleScrapeProduct}
                onViewDetails={navigateToProduct}
              />
            </section>

            {/* Catalog Search & Add Product Section */}
            <section className="card search-hero-card">
              <div className="section-header">
                <div>
                  <h3 className="section-title">Track a New Product</h3>
                  <p className="text-secondary text-small">
                    Search the INE mock store catalog by keyword (e.g. "fryer", "laptop") or product ID to add items to your dashboard.
                  </p>
                </div>
              </div>

              <SearchBar
                value={query}
                onChange={setQuery}
                onSearch={handleSearch}
                onClear={handleClearSearch}
                isLoading={isSearching}
              />
            </section>

            {/* Search Results Display */}
            {(activeSearchTerm || isSearching || searchError) && (
              <ProductSearchResults
                query={activeSearchTerm}
                results={searchResults}
                isLoading={isSearching}
                error={searchError}
                trackedStoreIds={trackedStoreIds}
                trackingId={trackingId}
                onTrack={handleTrackProduct}
                onRetry={() => handleSearch(activeSearchTerm)}
              />
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>INE Software Engineer Intern Assignment · Product Price Tracker</p>
      </footer>
    </div>
  );
}

export default App;
