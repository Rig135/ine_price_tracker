import React from 'react';

export function ErrorState({ title = 'An error occurred', message, onRetry }) {
  return (
    <div className="alert alert-error error-state" role="alert">
      <div className="error-icon" aria-hidden="true">⚠️</div>
      <div className="error-content">
        <strong>{title}</strong>
        {message && <p className="error-message">{message}</p>}
        {onRetry && (
          <button type="button" className="btn btn-retry" onClick={onRetry}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
