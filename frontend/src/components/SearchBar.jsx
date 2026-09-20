import React from 'react';

export function SearchBar({
  value = '',
  onChange,
  onSearch,
  onClear,
  isLoading = false,
  placeholder = 'Search mock store products by name, brand, category, or SKU...'
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSearch(value.trim());
    }
  };

  return (
    <form className="search-bar-form" onSubmit={handleSubmit} role="search">
      <div className="search-input-wrapper">
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          className="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          aria-label="Search products"
        />
        {value && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={onClear}
            disabled={isLoading}
            aria-label="Clear search query"
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>
      <button
        type="submit"
        className="btn btn-primary search-submit-btn"
        disabled={isLoading || !value.trim()}
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}
