/**
 * Consistent Timezone & Timestamp Handling Utilities
 * 
 * Documentation:
 * - All backend timestamps are stored in UTC (ISO 8601 strings, e.g. '2026-09-20T09:28:26.840Z').
 * - The frontend formats these timestamps into the user's browser local timezone while
 *   explicitly displaying the timezone identifier/abbreviation (e.g. "IST" or "(UTC+05:30)").
 * - Raw UTC timestamps are always preserved and inspectable via hover tooltips or table columns.
 */

/**
 * Get the user's browser timezone name (e.g. "Asia/Kolkata")
 */
export function getLocalTimezoneName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  } catch {
    return 'Local';
  }
}

/**
 * Get short timezone abbreviation or offset string (e.g. "IST" or "GMT+5:30")
 */
export function getLocalTimezoneAbbr(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short'
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : '';
  } catch {
    return '';
  }
}

/**
 * Format ISO string into a clear local datetime string with timezone label
 * Example: "20 Sep 2026, 03:28:26 PM IST"
 */
export function formatLocalTimestamp(isoString, options = {}) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';

  const {
    includeSeconds = true,
    showTz = true
  } = options;

  try {
    const formatted = date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true
    });

    if (!showTz) return formatted;
    const tz = getLocalTimezoneAbbr(date);
    return tz ? `${formatted} ${tz}` : formatted;
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Format ISO string into standard UTC representation
 * Example: "2026-09-20 09:28:26 UTC"
 */
export function formatUtcTimestamp(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Invalid Date';

  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());

  return `${y}-${m}-${d} ${hh}:${mm}:${ss} UTC`;
}

/**
 * Format relative time (e.g. "2 minutes ago", "just now")
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 15) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
