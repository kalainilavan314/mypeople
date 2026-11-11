import { areaName, type AreaLike, type AreaNames } from '@my-people/i18n/staff-terms';

import type { Locale } from './i18n/types';

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

/**
 * "Jaffna district" / "யாழ்ப்பாணம் மாவட்டம்" with the names the page loaded (loadAreaNames in
 * lib/areas.ts); "district LK41" when it has none for that area.
 */
export function areaText(area: AreaLike | null | undefined, names?: AreaNames, locale: Locale = 'en'): string {
  return area ? areaName(area, names, locale) : '—';
}

/** "request_update" → "request update". */
export function words(code: string | null | undefined): string {
  return code ? code.replace(/_/g, ' ') : '—';
}

/**
 * Sri Lanka standard time (Asia/Colombo) is UTC+05:30 with no daylight saving time.
 * Parses a `datetime-local` input (e.g. "2026-11-05T09:00") into an ISO string in UTC.
 */
export function parseSriLankaDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let toParse = trimmed;
  // If input format is YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss without timezone indicator
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const withSec = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    toParse = `${withSec}+05:30`;
  }
  const d = new Date(toParse);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Formats a UTC ISO string into "YYYY-MM-DDTHH:mm" in Sri Lanka standard time (Asia/Colombo, UTC+05:30)
 * suitable for `<input type="datetime-local">`, independent of the server's local timezone.
 */
export function toSriLankaDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Asia/Colombo is strictly UTC+05:30 year-round
  const colomboMs = d.getTime() + (5 * 60 + 30) * 60 * 1000;
  const colomboDate = new Date(colomboMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = colomboDate.getUTCFullYear();
  const month = pad(colomboDate.getUTCMonth() + 1);
  const day = pad(colomboDate.getUTCDate());
  const hours = pad(colomboDate.getUTCHours());
  const minutes = pad(colomboDate.getUTCMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
