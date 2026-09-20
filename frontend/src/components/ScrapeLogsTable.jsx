import React from 'react';

export function ScrapeLogsTable({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="table-empty-state">
        <p className="text-secondary">No scrape attempts recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table" aria-label="Scrape attempt audit logs">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Attempt</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Outcome / Error Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const statusUpper = (log.status || 'UNKNOWN').toUpperCase();
            const statusClass =
              log.status === 'success'
                ? 'status-badge-success'
                : log.status === 'retried'
                ? 'status-badge-retry'
                : 'status-badge-failed';

            return (
              <tr key={log.id}>
                <td className="time-cell">
                  {new Date(log.scraped_at || log.created_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </td>
                <td className="attempt-cell">
                  <span className="attempt-number">#{log.attempt_number}</span>
                </td>
                <td>
                  <span className={`status-badge ${statusClass}`}>
                    {statusUpper === 'RETRIED' ? 'RETRY' : statusUpper}
                  </span>
                </td>
                <td className="duration-cell">
                  {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                </td>
                <td className="details-cell">
                  {log.status === 'success' ? (
                    <span className="text-success">
                      ✓ Clean extraction
                      {log.extracted_price ? ` (Price: ₹${Number(log.extracted_price).toFixed(2)}, Stock: ${log.extracted_stock})` : ''}
                    </span>
                  ) : (
                    <span className="text-danger error-log-text" title={log.error_message || 'Scrape failure'}>
                      {log.error_message || 'Unknown scrape failure'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
