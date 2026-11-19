/** Reading the "add slots" form: Sri Lankan date and time in, an ISO start with +05:30 out. */

export const SLOT_MINUTES = [15, 20, 30, 45, 60] as const;
export const MAX_SLOTS = 16;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "2026-12-01" and "09:30" as Sri Lankan time, or null when either is not a real date or time. */
export function colomboStart(date: string, time: string): string | null {
  const day = DATE.exec(date.trim());
  const clock = TIME.exec(time.trim());
  if (!day || !clock) return null;
  const [, year, month, dayOfMonth] = day;
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(dayOfMonth)));
  if (check.getUTCMonth() !== Number(month) - 1 || check.getUTCDate() !== Number(dayOfMonth)) return null;
  const hours = clock[1]!.padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}T${hours}:${clock[2]}:00+05:30`;
}

export function slotCount(value: string): number | null {
  const count = Number(value.trim());
  return Number.isInteger(count) && count >= 1 && count <= MAX_SLOTS ? count : null;
}

/** When the last slot of the series ends, for the preview line. */
export function seriesEnd(startIso: string, minutes: number, count: number): string {
  return new Date(Date.parse(startIso) + minutes * count * 60_000).toISOString();
}
