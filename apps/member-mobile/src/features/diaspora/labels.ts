/** The city part of an IANA time zone, e.g. "America/Toronto" → "Toronto", "America/New_York" → "New York". */
export function zoneCity(zone: string): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

/** A date-only value ("2026-07-15") as a moment at noon UTC, so it formats as the same calendar day. */
export function dateOnly(value: string): string {
  return `${value}T12:00:00Z`;
}
