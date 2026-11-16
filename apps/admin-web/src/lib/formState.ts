/**
 * What a Server Action hands back to its form after a refusal: the error and problem codes and the
 * values typed, so nothing has to be typed again. Nothing here goes into the address. The case file
 * has its own copy (features/cases/forms.ts); the participation pages (volunteering, moderation,
 * development proposals, surveys, learning) share this one.
 */
export type FormState = {
  error: string;
  problems: string[];
  values: Record<string, string>;
  /** Changes on every refused attempt, so the form's error summary is announced again. */
  attempt: number;
} | null;

export type FormLike = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

/** Where a problem points: a field name in the form, or nothing when it is about the whole form. */
export type ProblemTargets = Readonly<Record<string, string>>;

const UUID = /^[0-9a-f-]{36}$/i;

export function text(form: FormLike, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function uuidOrNull(form: FormLike, name: string): string | null {
  const value = text(form, name);
  return UUID.test(value) ? value : null;
}

/** Every checked value of a checkbox group, trimmed, without blanks or repeats. */
export function checked(form: FormLike, name: string): string[] {
  const values = form.getAll(name).filter((entry): entry is string => typeof entry === 'string');
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/** The typed values to give back after a refusal (text only; files are never echoed). */
export function valuesOf(form: FormLike, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, text(form, name)]));
}

/** A refusal found before calling the API; `error` names the module's own refusal code. */
export function incomplete(error: string, problems: string[], values: Record<string, string>): FormState {
  return { error, problems, values, attempt: Date.now() };
}

/** A problem code without its detail: "options_required:2" → "options_required". */
export function problemCode(problem: string): string {
  return problem.split(':', 1)[0];
}

/** The field a problem points at, from the form's table; "code:detail" problems use the code. */
export function targetOf(targets: ProblemTargets, problem: string): string | undefined {
  return targets[problem] ?? targets[problemCode(problem)];
}

/**
 * A `datetime-local` value in Sri Lankan time (UTC+05:30, no daylight saving) as an ISO string in
 * UTC, or null when it is empty or not a date. Kept here, without imports, so tests can load it.
 */
export function colomboDateTime(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}+05:30`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A whole number in a range, or null. */
export function wholeNumber(value: string, min: number, max: number): number | null {
  if (!/^\d{1,6}$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

/** An area as "level:code" from a picker; the API takes a province, district, DS division or GN. */
export function readArea(value: string): { level: 'province' | 'district' | 'ds' | 'gn'; code: string } | null {
  const [level, code] = value.split(':', 2);
  if (level !== 'province' && level !== 'district' && level !== 'ds' && level !== 'gn') return null;
  const trimmed = (code ?? '').trim();
  return trimmed.length >= 2 && trimmed.length <= 20 ? { level, code: trimmed } : null;
}

/** Counts the API hides for small groups come back as null: shown as "fewer than 10". */
export function countText(count: number | null | undefined): string {
  if (count === null) return 'fewer than 10';
  return String(count ?? 0);
}

export function countTextTa(count: number | null | undefined): string {
  if (count === null) return '10 இலும் குறைவு';
  return String(count ?? 0);
}
