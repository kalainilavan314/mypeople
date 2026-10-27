// Dates and times in Sri Lankan time (Asia/Colombo), whatever the server's zone.
const OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('en-GB', OPTIONS) : '—';
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

/** "district LK41" or "platform", as the API names areas. */
export function areaText(area: { level: string; code?: string | null } | string | null | undefined): string {
  if (!area) return '—';
  if (typeof area === 'string') return area.replace(':', ' ');
  return area.level === 'platform' ? 'platform' : `${area.level} ${area.code}`;
}

/** "request_update" → "request update". */
export function words(code: string | null | undefined): string {
  return code ? code.replace(/_/g, ' ') : '—';
}
