import React from 'react';

export function TrackProductButton({
  isTracked = false,
  isTracking = false,
  onClick,
  disabled = false
}) {
  if (isTracked) {
    return (
      <button
        type="button"
        className="btn btn-tracked"
        disabled
        title="Product is already tracked"
        aria-label="Product is already tracked"
      >
        <span className="btn-icon">✓</span>
        Tracked
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-track"
      onClick={onClick}
      disabled={disabled || isTracking}
      aria-label="Track this product"
    >
      {isTracking ? (
        <>
          <span className="button-spinner" aria-hidden="true" />
          <span>Tracking...</span>
        </>
      ) : (
        <>
          <span className="btn-icon">+</span>
          <span>Track Product</span>
        </>
      )}
    </button>
  );
}
