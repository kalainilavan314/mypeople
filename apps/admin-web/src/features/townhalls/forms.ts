import type { TownHallArchiveInput, TownHallInput } from '@my-people/api-client';

import { colomboDateTime, readArea, text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the town hall API uses, and the one the dashboard's own checks use too. */
export const TOWNHALL_REFUSED = 'townhall_refused';
/** Said for the API's 409 "silence_period" on a town hall: an election silence window covers it. */
export const TOWNHALL_SILENCE = 'townhall_silence_period';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };
export type TownHallState = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

export const LANGUAGES = ['ta', 'en', 'both'] as const;
export const LANGUAGE_LABELS: Readonly<Record<(typeof LANGUAGES)[number], Words>> = {
  ta: { ta: 'தமிழ்', en: 'Tamil' },
  en: { ta: 'ஆங்கிலம்', en: 'English' },
  both: { ta: 'தமிழும் ஆங்கிலமும்', en: 'Tamil and English' },
};

export const STATE_LABELS: Readonly<Record<TownHallState, Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  scheduled: { ta: 'திட்டமிடப்பட்டது', en: 'Scheduled' },
  live: { ta: 'நேரலையில்', en: 'Live' },
  ended: { ta: 'முடிவுற்றது', en: 'Ended' },
  cancelled: { ta: 'இரத்து செய்யப்பட்டது', en: 'Cancelled' },
};
export const STATE_TONES: Readonly<Record<TownHallState, 'waiting' | 'done' | 'refused' | 'neutral'>> = {
  draft: 'neutral',
  scheduled: 'waiting',
  live: 'refused',
  ended: 'done',
  cancelled: 'neutral',
};

/** The API's MOVES: draft → scheduled or cancelled; scheduled → live or cancelled; live → ended. */
export const MOVES: Readonly<Record<TownHallState, readonly ('scheduled' | 'live' | 'ended' | 'cancelled')[]>> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['live', 'cancelled'],
  live: ['ended'],
  ended: [],
  cancelled: [],
};
export const MOVE_LABELS: Readonly<Record<'scheduled' | 'live' | 'ended' | 'cancelled', Words>> = {
  scheduled: { ta: 'திட்டமிடவும்', en: 'Schedule' },
  live: { ta: 'நேரலையைத் தொடங்கவும்', en: 'Go live' },
  ended: { ta: 'நிறைவுசெய்யவும்', en: 'End the session' },
  cancelled: { ta: 'இரத்து செய்யவும்', en: 'Cancel' },
};

export const TOWNHALL_FIELDS = [
  'titleTa', 'titleEn', 'descriptionTa', 'descriptionEn', 'speakersTa', 'speakersEn', 'language', 'startsAt', 'endsAt', 'streamUrl',
  'audioUrl', 'captionsUrl', 'legalReviewRef', 'area',
] as const;

export const TOWNHALL_TARGETS: ProblemTargets = {
  title_required: 'titleTa',
  description_required: 'descriptionTa',
  speakers_required: 'speakersTa',
  language_required: 'language',
  starts_at_required: 'startsAt',
  ends_at_required: 'endsAt',
  ends_before_start: 'endsAt',
  https_link_required: 'streamUrl',
  area_required: 'area',
  unknown_area: 'area',
  legal_review_required: 'legalReviewRef',
  reason_required: 'reason',
  decision_required: 'decision',
  merge_target_required: 'mergeInto',
  merge_target_not_approved: 'mergeInto',
  time_required: 'atSecond',
  bilingual_answer_required: 'answerTa',
  outcome_text_required: 'outcomesJson',
  recording_link_https: 'recordingUrl',
};

const HTTPS = /^https:\/\/\S+$/;

/** An optional link: empty is fine; anything else must be https. */
function link(form: FormLike, name: string): { value: string | null; ok: boolean } {
  const value = text(form, name);
  return { value: value || null, ok: !value || HTTPS.test(value) };
}

/**
 * FR-THL-001: a session in Tamil and English with its language, speakers, area and times. The
 * stream, audio and captions links are optional until the streaming provider is chosen (OD-44); a
 * legal review reference is needed in an election period.
 */
export function readTownHall(form: FormLike, { needsArea }: { needsArea: boolean }): Read<TownHallInput> {
  const t = (name: string) => text(form, name);
  const language = LANGUAGES.find((item) => item === t('language'));
  const startsAt = colomboDateTime(t('startsAt'));
  const endsAt = colomboDateTime(t('endsAt'));
  const links = ['streamUrl', 'audioUrl', 'captionsUrl'].map((name) => link(form, name));
  const area = needsArea ? readArea(t('area')) : null;
  const problems = [
    ...(t('titleTa') && t('titleEn') ? [] : ['title_required']),
    ...(t('descriptionTa') && t('descriptionEn') ? [] : ['description_required']),
    ...(t('speakersTa') && t('speakersEn') ? [] : ['speakers_required']),
    ...(language ? [] : ['language_required']),
    ...(startsAt ? [] : ['starts_at_required']),
    ...(endsAt ? [] : ['ends_at_required']),
    ...(startsAt && endsAt && endsAt <= startsAt ? ['ends_before_start'] : []),
    ...(links.every((item) => item.ok) ? [] : ['https_link_required']),
    ...(needsArea && !area ? ['area_required'] : []),
  ];
  if (problems.length > 0 || !language || !startsAt || !endsAt) return { input: null, problems };
  return {
    input: {
      titleTa: t('titleTa'),
      titleEn: t('titleEn'),
      descriptionTa: t('descriptionTa'),
      descriptionEn: t('descriptionEn'),
      speakersTa: t('speakersTa'),
      speakersEn: t('speakersEn'),
      language,
      startsAt,
      endsAt,
      streamUrl: links[0].value,
      audioUrl: links[1].value,
      captionsUrl: links[2].value,
      legalReviewRef: t('legalReviewRef') || null,
      ...(area ? { area } : {}),
    },
    problems,
  };
}

/** FR-THL-005: approve; merge into an approved question; or reject. Merging and rejecting need a reason. */
export function readModeration(form: FormLike): Read<{ decision: 'approve' | 'reject' | 'merge'; reason?: string; mergeInto?: string }> {
  const decision = text(form, 'decision');
  const reason = text(form, 'reason');
  if (decision === 'approve') return { input: { decision }, problems: [] };
  if (decision !== 'reject' && decision !== 'merge') return { input: null, problems: ['decision_required'] };
  const mergeInto = text(form, 'mergeInto');
  const problems = [...(reason ? [] : ['reason_required']), ...(decision === 'merge' && !/^[0-9a-f-]{36}$/i.test(mergeInto) ? ['merge_target_required'] : [])];
  if (problems.length) return { input: null, problems };
  return { input: decision === 'merge' ? { decision, reason, mergeInto } : { decision, reason }, problems };
}

/** FR-THL-006: answered live (at a second of the recording) or in writing in both languages. */
export function readAnswer(form: FormLike): Read<{ mode: 'live' | 'written'; atSecond?: number; answerEn?: string; answerTa?: string }> {
  const mode = text(form, 'mode');
  if (mode === 'live') {
    const seconds = text(form, 'atSecond');
    if (!/^\d{1,6}$/.test(seconds)) return { input: null, problems: ['time_required'] };
    return { input: { mode, atSecond: Number(seconds) }, problems: [] };
  }
  if (mode !== 'written') return { input: null, problems: ['decision_required'] };
  const answerTa = text(form, 'answerTa');
  const answerEn = text(form, 'answerEn');
  if (!answerTa || !answerEn) return { input: null, problems: ['bilingual_answer_required'] };
  return { input: { mode, answerTa, answerEn }, problems: [] };
}

/**
 * FR-THL-007: the archive of an ended session: the recording, transcripts, and outcomes in both
 * languages, each linked to a promise (its id) or a community case (its number) where there is one.
 */
export function readArchive(form: FormLike): Read<TownHallArchiveInput> {
  const recording = link(form, 'recordingUrl');
  let raw: unknown;
  try {
    raw = JSON.parse(text(form, 'outcomesJson') || '[]');
  } catch {
    raw = [];
  }
  const list = Array.isArray(raw) ? raw : [];
  const problems: string[] = recording.ok ? [] : ['recording_link_https'];
  const outcomes = list.slice(0, 50).map((item, index) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const str = (key: string) => (typeof entry[key] === 'string' ? (entry[key] as string).trim() : '');
    if (str('textTa').length < 3 || str('textEn').length < 3) problems.push(`outcome_text_required:${index + 1}`);
    return {
      textTa: str('textTa'),
      textEn: str('textEn'),
      promiseId: /^[0-9a-f-]{36}$/i.test(str('promiseId')) ? str('promiseId') : null,
      caseNumber: str('caseNumber').toUpperCase() || null,
    };
  });
  if (problems.length) return { input: null, problems };
  return {
    input: { recordingUrl: recording.value, transcriptTa: text(form, 'transcriptTa') || null, transcriptEn: text(form, 'transcriptEn') || null, outcomes },
    problems,
  };
}

/** A 409 "silence_period" on a town hall is said with its own sentence. */
export function townhallRefusalCode(status: number, code: string): string {
  return status === 409 && code === 'silence_period' ? TOWNHALL_SILENCE : code;
}

/** "1:02:05" for an answer given live at a second of the recording. */
export function atTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
