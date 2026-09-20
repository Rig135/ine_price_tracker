import React from 'react';

export function Navbar({ backendHealth }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="brand-logo">🏷️</span>
        <div>
          <h1 className="brand-title">INE Price Tracker</h1>
          <p className="brand-subtitle">Automated product price & stock monitoring</p>
        </div>
      </div>

      <div className="navbar-status">
        <span className="status-indicator">
          <span className={`status-dot ${backendHealth?.status === 'ok' ? 'status-online' : 'status-offline'}`} />
          Backend: {backendHealth?.status === 'ok' ? 'Online' : 'Checking...'}
        </span>
      </div>
    </header>
  );
}
