// Dates and times in Sri Lankan time (Asia/Colombo), whatever the phone's own
// time zone, so an event shows the same time to everyone (spec §9).
const TIME_ZONE = 'Asia/Colombo';

function locale(language: string): string {
  return language === 'ta' ? 'ta-LK' : 'en-LK';
}

export function formatDate(iso: string, language: string): string {
  return new Date(iso).toLocaleDateString(locale(language), {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(iso: string, language: string): string {
  return new Date(iso).toLocaleTimeString(locale(language), { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string, language: string): string {
  return `${formatDate(iso, language)}, ${formatTime(iso, language)}`;
}

/** "08:00 – 11:00", or with both dates when the event spans days. */
export function formatSpan(startIso: string, endIso: string, language: string): string {
  const sameDay = formatDate(startIso, language) === formatDate(endIso, language);
  return sameDay
    ? `${formatTime(startIso, language)} – ${formatTime(endIso, language)}`
    : `${formatDateTime(startIso, language)} – ${formatDateTime(endIso, language)}`;
}

/** The month (short) and day for a date badge. */
export function dateBadgeParts(iso: string, language: string): { month: string; day: string; full: string } {
  const date = new Date(iso);
  return {
    month: date.toLocaleDateString(locale(language), { timeZone: TIME_ZONE, month: 'short' }),
    day: date.toLocaleDateString(locale(language), { timeZone: TIME_ZONE, day: 'numeric' }),
    full: date.toLocaleDateString(locale(language), {
      timeZone: TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

/** The hour in Sri Lanka, for the greeting. */
export function localHour(now: Date = new Date()): number {
  return Number(now.toLocaleTimeString('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hour12: false }).slice(0, 2));
}
