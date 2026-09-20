import React from 'react';

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-container" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span className="loading-text">{message}</span>
    </div>
  );
}
