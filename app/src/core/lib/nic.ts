export type NicFormat = 'old' | 'new';
export type Gender = 'male' | 'female';

export interface NicInfo {
  valid: boolean;
  format: NicFormat | null;
  normalized: string;
  birthYear?: number;
  dayOfYear?: number;
  dob?: Date;
  gender?: Gender;
  age?: number;
  votingEligible?: boolean;
  error?: 'empty' | 'format' | 'dayOfYear';
}

const OLD_RE = /^(\d{2})(\d{3})(\d{4})([VXvx])$/;
const NEW_RE = /^(\d{4})(\d{3})(\d{5})$/;

function dayOfYearToDate(year: number, day: number): Date {
  const ref = new Date(Date.UTC(2000, 0, 1));
  ref.setUTCDate(ref.getUTCDate() + (day - 1));
  return new Date(Date.UTC(year, ref.getUTCMonth(), ref.getUTCDate()));
}

function ageFrom(dob: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function parseNic(raw: string): NicInfo {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) return { valid: false, format: null, normalized, error: 'empty' };

  let format: NicFormat | null = null;
  let yy = 0;
  let days = 0;

  const oldM = OLD_RE.exec(normalized);
  const newM = NEW_RE.exec(normalized);
  if (oldM) {
    format = 'old';
    yy = 1900 + Number(oldM[1]);
    days = Number(oldM[2]);
  } else if (newM) {
    format = 'new';
    yy = Number(newM[1]);
    days = Number(newM[2]);
  } else {
    return { valid: false, format: null, normalized, error: 'format' };
  }

  const gender: Gender = days > 500 ? 'female' : 'male';
  let dayOfYear = gender === 'female' ? days - 500 : days;

  if (dayOfYear < 1 || dayOfYear > 366) {
    return { valid: false, format, normalized, error: 'dayOfYear' };
  }

  const dob = dayOfYearToDate(yy, dayOfYear);
  const age = ageFrom(dob);

  return {
    valid: true,
    format,
    normalized,
    birthYear: yy,
    dayOfYear,
    dob,
    gender,
    age,
    votingEligible: age >= 18,
  };
}

export function isValidNic(raw: string): boolean {
  return parseNic(raw).valid;
}

export function formatDob(dob: Date): string {
  return dob.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
