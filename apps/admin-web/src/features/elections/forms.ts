import type { ElectionNoticeInput, ElectionPeriodInput } from '@my-people/api-client';

import { parseSriLankaDateTime } from '../../lib/format.ts';

/**
 * What a form action hands back to its page after a refusal: the error and problem codes, and the
 * values typed, so a long form never has to be typed again. Nothing here goes into the address.
 */
export type FormState = {
  error: string;
  problems: string[];
  values: Record<string, string>;
  /** Changes on every refused attempt, so the error summary is announced and focused again. */
  attempt: number;
} | null;

type FormLike = { get(name: string): FormDataEntryValue | null };

export const ELECTION_TYPES = ['presidential', 'parliamentary', 'provincial', 'local', 'referendum'] as const;
export const AREA_LEVELS = ['platform', 'province', 'district', 'ds', 'gn'] as const;
export const NOTICE_SOURCES = ['election_commission', 'party'] as const;

const PERIOD_FIELDS = [
  'electionType',
  'titleEn',
  'titleTa',
  'areaLevel',
  'areaCode',
  'startsAt',
  'endsAt',
  'silenceStartsAt',
  'silenceEndsAt',
  'pollingDay',
  'sourceUrl',
  'sourceReference',
  'sourcePublishedAt',
] as const;
const NOTICE_FIELDS = ['source', 'titleEn', 'titleTa', 'bodyEn', 'bodyTa', 'sourceUrl', 'documentReference', 'sourcePublishedAt'] as const;

// Election text is public: a Sri Lankan NIC number (old: 9 digits and V or X; new: 12 digits) must
// never appear in it, so no member's identity reaches a notice (FR-ELX-010).
const NIC_PATTERN = /\b(?:\d{9}[vVxX]|\d{12})\b/;
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = 'https://';

function text(form: FormLike, name: string): string {
  return String(form.get(name) ?? '').trim();
}

function readValues(form: FormLike, fields: readonly string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, text(form, field)]));
}

function isOneOf<T extends string>(options: readonly T[], value: string): value is T {
  return (options as readonly string[]).includes(value);
}

function fits(value: string, max: number): boolean {
  return value.length > 0 && value.length <= max;
}

function isHttpsLink(value: string): boolean {
  return value.startsWith(HTTPS) && value.length > HTTPS.length && value.length <= 500;
}

/**
 * Checks the declare form against the API's field limits, so a mistake comes back as a named
 * problem rather than a bare "invalid_request". The election rules themselves (silence inside the
 * period, covering the polling day) stay with the API, which names them as problems too.
 */
export function readPeriodForm(form: FormLike): { input: ElectionPeriodInput | null; problems: string[]; values: Record<string, string> } {
  const values = readValues(form, PERIOD_FIELDS);
  values.areaCode = values.areaCode.toUpperCase();
  const problems: string[] = [];

  const { electionType, titleEn, titleTa, areaLevel, areaCode, pollingDay, sourceUrl, sourceReference } = values;
  if (!isOneOf(ELECTION_TYPES, electionType)) problems.push('election_type_required');
  if (!fits(titleEn, 160)) problems.push('title_en_required');
  if (!fits(titleTa, 160)) problems.push('title_ta_required');
  if (NIC_PATTERN.test(titleEn) || NIC_PATTERN.test(titleTa)) problems.push('contains_id_number');
  if (!isOneOf(AREA_LEVELS, areaLevel)) problems.push('area_level_required');
  else if (areaLevel !== 'platform' && !areaCode) problems.push('area_code_required');

  const startsAt = parseSriLankaDateTime(values.startsAt);
  const endsAt = parseSriLankaDateTime(values.endsAt);
  const silenceStartsAt = parseSriLankaDateTime(values.silenceStartsAt);
  const silenceEndsAt = parseSriLankaDateTime(values.silenceEndsAt);
  const sourcePublishedAt = parseSriLankaDateTime(values.sourcePublishedAt);
  if (!startsAt) problems.push('starts_at_required');
  if (!endsAt) problems.push('ends_at_required');
  if (!silenceStartsAt) problems.push('silence_starts_at_required');
  if (!silenceEndsAt) problems.push('silence_ends_at_required');
  if (!CALENDAR_DAY.test(pollingDay)) problems.push('polling_day_required');
  if (!isHttpsLink(sourceUrl)) problems.push('source_url_https');
  if (!fits(sourceReference, 200)) problems.push('source_reference_required');
  if (!sourcePublishedAt) problems.push('source_published_at_required');

  const confirmed = form.get('confirm') === '1';
  if (!confirmed) problems.push('confirmation_required');

  if (
    problems.length > 0 ||
    !isOneOf(ELECTION_TYPES, electionType) ||
    !isOneOf(AREA_LEVELS, areaLevel) ||
    !startsAt ||
    !endsAt ||
    !silenceStartsAt ||
    !silenceEndsAt ||
    !sourcePublishedAt
  ) {
    return { input: null, problems, values };
  }
  return {
    input: {
      electionType,
      titleEn,
      titleTa,
      area: { level: areaLevel, code: areaLevel === 'platform' ? null : areaCode },
      startsAt,
      endsAt,
      silenceStartsAt,
      silenceEndsAt,
      pollingDay,
      sourceUrl,
      sourceReference,
      sourcePublishedAt,
    },
    problems: [],
    values,
  };
}

/**
 * Checks a notice against the API's field limits. Whether Election Commission information names its
 * link, document and publication time (NFR-ELC-06) is the API's rule; it answers
 * "official_source_required".
 */
export function readNoticeForm(form: FormLike): { input: ElectionNoticeInput | null; problems: string[]; values: Record<string, string> } {
  const values = readValues(form, NOTICE_FIELDS);
  const problems: string[] = [];

  const { source, titleEn, titleTa, bodyEn, bodyTa, sourceUrl, documentReference } = values;
  if (!isOneOf(NOTICE_SOURCES, source)) problems.push('notice_source_required');
  if (!fits(titleEn, 160)) problems.push('title_en_required');
  if (!fits(titleTa, 160)) problems.push('title_ta_required');
  if (!fits(bodyEn, 2000)) problems.push('body_en_required');
  if (!fits(bodyTa, 2000)) problems.push('body_ta_required');
  if ([titleEn, titleTa, bodyEn, bodyTa].some((value) => NIC_PATTERN.test(value))) problems.push('contains_id_number');
  if (sourceUrl && !isHttpsLink(sourceUrl)) problems.push('source_url_https');
  if (documentReference.length > 200) problems.push('document_reference_invalid');
  const sourcePublishedAt = values.sourcePublishedAt ? parseSriLankaDateTime(values.sourcePublishedAt) : null;
  if (values.sourcePublishedAt && !sourcePublishedAt) problems.push('source_published_at_required');

  if (problems.length > 0 || !isOneOf(NOTICE_SOURCES, source)) return { input: null, problems, values };
  return {
    input: {
      source,
      titleEn,
      titleTa,
      bodyEn,
      bodyTa,
      sourceUrl: sourceUrl || null,
      documentReference: documentReference || null,
      sourcePublishedAt,
    },
    problems: [],
    values,
  };
}

/** Ending (the election is over) or withdrawing (declared in error), with the reason kept on the period. */
export function readCloseForm(form: FormLike): { input: { action: 'end' | 'withdraw'; reason: string } | null; problems: string[] } {
  const action = text(form, 'closeAction');
  const reason = text(form, 'reason');
  const problems: string[] = [];
  if (action !== 'end' && action !== 'withdraw') problems.push('close_action_required');
  if (reason.length < 3 || reason.length > 500) problems.push('reason_required');
  if (form.get('confirm') !== '1') problems.push('confirmation_required');
  if (problems.length > 0 || (action !== 'end' && action !== 'withdraw')) return { input: null, problems };
  return { input: { action, reason }, problems: [] };
}
