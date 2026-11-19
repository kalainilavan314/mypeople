import type {
  AssistantErrorReportState,
  AssistantHandoverState,
  AssistantOutcome,
  AssistantPreview,
  KnowledgeSourceInput,
  KnowledgeSourceKind,
  KnowledgeSourceState,
} from '@my-people/api-client';

import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

// D20 Assistant knowledge base (FR-AIA-003, 004, 007, 008, ENT-62). Knowledge Editors (ai.kb.manage)
// draft approved sources; a second editor approves each version. The API checks every rule again.

/** The refusal code the knowledge-base API uses, and the one the dashboard's own checks use too. */
export const SOURCE_REFUSED = 'source_refused';
/** The refusal the assistant's queues use (already resolved or closed). */
export const ASSISTANT_REFUSED = 'assistant_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };
export type Tone = 'waiting' | 'done' | 'refused' | 'neutral';

export const KNOWLEDGE_PERMISSION = 'ai.kb.manage';
/** What a page says when the API answers "forbidden". */
export const KNOWLEDGE_REFUSED = 'The assistant knowledge base needs the Knowledge Editor permission (ai.kb.manage).';
export const TRY_REFUSED = 'Trying questions needs the Knowledge Editor permission or an AI governance permission.';

export const KINDS: readonly KnowledgeSourceKind[] = ['policy', 'manifesto', 'app_help', 'public_service_guide'];
export const KIND_LABELS: Readonly<Record<KnowledgeSourceKind, Words>> = {
  policy: { ta: 'அமைப்பின் கொள்கை', en: 'Organisational policy' },
  manifesto: { ta: 'வெளியிடப்பட்ட தேர்தல் விஞ்ஞாபனம்', en: 'Published manifesto material' },
  app_help: { ta: 'செயலி உதவி', en: 'App help' },
  public_service_guide: { ta: 'பொதுச் சேவை வழிகாட்டி', en: 'Public-service guide' },
};

export const STATES: readonly KnowledgeSourceState[] = ['draft', 'approved', 'superseded', 'retired'];
export const STATE_LABELS: Readonly<Record<KnowledgeSourceState, Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  approved: { ta: 'அங்கீகரிக்கப்பட்டது, பயன்பாட்டில்', en: 'Approved, in use' },
  superseded: { ta: 'புதிய பதிப்பால் மாற்றப்பட்டது', en: 'Superseded by a newer version' },
  retired: { ta: 'பயன்பாட்டிலிருந்து நீக்கப்பட்டது', en: 'Retired' },
};
export const STATE_TONES: Readonly<Record<KnowledgeSourceState, Tone>> = {
  draft: 'waiting',
  approved: 'done',
  superseded: 'neutral',
  retired: 'neutral',
};
export const REVIEW_OVERDUE_LABEL: Words = {
  ta: 'மீளாய்வுத் திகதி கடந்துவிட்டது: மீளாய்வு செய்யும் வரை உதவியாளர் பயன்படுத்தாது',
  en: 'Review overdue: not used by the assistant until reviewed',
};

export const OUTCOME_LABELS: Readonly<Record<AssistantOutcome, Words>> = {
  answered: { ta: 'மூலங்களிலிருந்து பதில் அளிக்கப்பட்டது', en: 'Answered from the sources' },
  no_source: { ta: 'அங்கீகரிக்கப்பட்ட மூலம் இல்லை: பதில் இல்லை', en: 'No approved source: not answered' },
  refused: { ta: 'விதிகளின்படி மறுக்கப்பட்டது', en: 'Declined under the rules' },
  failed: { ta: 'பதில் தயாரிக்க முடியவில்லை', en: 'No answer could be prepared' },
};
export const OUTCOME_TONES: Readonly<Record<AssistantOutcome, Tone>> = {
  answered: 'done',
  no_source: 'neutral',
  refused: 'waiting',
  failed: 'refused',
};
export const REFUSAL_LABELS: Readonly<Record<string, Words>> = {
  eligibility: { ta: 'தகுதி பற்றிய தீர்மானம் (எடுக்கப்படவில்லை)', en: 'Eligibility decision (never made)' },
  promise: { ta: 'புதிய வாக்குறுதி (மறுக்கப்பட்டது)', en: 'A new promise (declined)' },
  figures: { ta: 'மூலத்தில் இல்லாத எண்ணிக்கைகள் (மறுக்கப்பட்டது)', en: 'Figures not in a source (declined)' },
  election_notice: { ta: 'தேர்தல் அறிவித்தல் (தேர்தல் ஆணைக்குழுவிடம் பார்க்கவும்)', en: 'Election notice (check the Election Commission)' },
  persuasion: { ta: 'அரசியல் தூண்டல் (நடுநிலை பேணப்பட்டது)', en: 'Political persuasion (kept neutral)' },
  personal_data: { ta: 'தனிநபர் தரவு (மறுக்கப்பட்டது)', en: 'Personal data (declined)' },
  other: { ta: 'வேறு காரணம்', en: 'Other reason' },
};
export const REDACTION_LABELS: Readonly<Record<string, Words>> = {
  nic: { ta: 'அடையாள அட்டை இலக்கம்', en: 'NIC number' },
  phone: { ta: 'தொலைபேசி இலக்கம்', en: 'phone number' },
  case_reference: { ta: 'குறிப்பு இலக்கம்', en: 'case reference' },
  email: { ta: 'மின்னஞ்சல்', en: 'e-mail address' },
};
export const MODEL_STATUS_LABELS: Readonly<Record<AssistantPreview['modelStatus'], Words>> = {
  shadow: { ta: 'நிழல் முறை (உறுப்பினர்களுக்குக் காட்டப்படாது)', en: 'Shadow mode (never shown to members)' },
  live: { ta: 'நேரடிப் பயன்பாட்டில்', en: 'Live' },
  retired: { ta: 'ஓய்வு', en: 'Retired' },
};

export const ERROR_STATES: readonly AssistantErrorReportState[] = ['open', 'fixed', 'no_change'];
export const ERROR_STATE_LABELS: Readonly<Record<AssistantErrorReportState, Words>> = {
  open: { ta: 'திறந்துள்ளது', en: 'Open' },
  fixed: { ta: 'மூலம் திருத்தப்பட்டது', en: 'Fixed' },
  no_change: { ta: 'மாற்றம் தேவையில்லை', en: 'No change needed' },
};
export const ERROR_STATE_TONES: Readonly<Record<AssistantErrorReportState, Tone>> = { open: 'waiting', fixed: 'done', no_change: 'neutral' };

export const HANDOVER_STATES: readonly AssistantHandoverState[] = ['open', 'answered', 'closed'];
export const HANDOVER_STATE_LABELS: Readonly<Record<AssistantHandoverState, Words>> = {
  open: { ta: 'பதிலுக்காகக் காத்திருக்கிறது', en: 'Waiting for a reply' },
  answered: { ta: 'பதில் அனுப்பப்பட்டது', en: 'Answered' },
  closed: { ta: 'மூடப்பட்டது', en: 'Closed' },
};
export const HANDOVER_STATE_TONES: Readonly<Record<AssistantHandoverState, Tone>> = { open: 'waiting', answered: 'done', closed: 'neutral' };

/** Why the assistant cannot answer yet, said plainly (503 assistant_unavailable). */
export const UNAVAILABLE_WORDS: Readonly<Record<string, Words>> = {
  provider_not_configured: {
    ta: 'இன்னும் கிடைக்கவில்லை: சேவையகத்தில் AI வழங்குநர் அமைக்கப்படவில்லை (AI_PROVIDER=none). AI வழங்குநர் பற்றிய முடிவு (OD-42) இன்னும் எடுக்கப்படவில்லை; எதுவும் வெளியே அனுப்பப்படுவதில்லை.',
    en: 'Not available yet, because no AI provider is set up on the server (AI_PROVIDER=none). The provider decision (OD-42) is still open, so nothing is sent anywhere.',
  },
  model_not_registered: {
    ta: 'இன்னும் கிடைக்கவில்லை: சேவையகம் அழைக்கும் மாதிரி AI மாதிரிகள் பதிவேட்டில் இல்லை. AI நிர்வாகப் பொறுப்பாளர் அதை முதலில் பதிவுசெய்ய வேண்டும்.',
    en: 'Not available yet, because the model the server is set up to call is not in the AI model registry. The AI Governance Lead registers it first.',
  },
  model_not_approved: {
    ta: 'இன்னும் கிடைக்கவில்லை: AI நிர்வாகப் பொறுப்பாளர் இன்னும் எந்த மாதிரியையும் நேரடிப் பயன்பாட்டுக்கு அனுமதிக்கவில்லை.',
    en: 'Not available yet, because the AI Governance Lead has not made a model live.',
  },
};

export const SOURCE_TEXT_FIELDS = [
  'kind', 'titleTa', 'titleEn', 'bodyTa', 'bodyEn', 'publisher', 'sourceUrl', 'publishedOn', 'reviewDue', 'changeNote',
] as const;

export const SOURCE_TARGETS: ProblemTargets = {
  kind_required: 'kind',
  kb_title_required: 'titleTa',
  source_text_required: 'bodyTa',
  kb_body_too_short: 'bodyTa',
  publisher_required: 'publisher',
  source_url_invalid: 'sourceUrl',
  review_due_required: 'reviewDue',
  review_date_must_be_ahead: 'reviewDue',
  review_date_too_far: 'reviewDue',
  reason_required: 'reason',
  decision_required: 'decision',
  resolution_required: 'resolution',
  outcome_required: 'outcome',
  handover_reply_required: 'reply',
  question_required: 'question',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateOrNull = (form: FormLike, name: string) => (DATE.test(text(form, name)) ? text(form, name) : null);

/** Today's date in Sri Lankan time (UTC+05:30, no daylight saving), as YYYY-MM-DD. */
export function colomboToday(now: Date): string {
  return new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}

/** The default next review: one year from today in Sri Lankan time. */
export function defaultReviewDue(now: Date): string {
  const today = colomboToday(now);
  const [year, month, day] = today.split('-');
  return `${Number(year) + 1}-${month}-${day === '29' && month === '02' ? '28' : day}`;
}

/** A source in Tamil and English (either text may be left out, not both), with a review date ahead. */
export function readSource(form: FormLike, now: Date): Read<KnowledgeSourceInput> {
  const t = (name: string) => text(form, name);
  const kind = KINDS.find((k) => k === t('kind'));
  const bodyTa = t('bodyTa');
  const bodyEn = t('bodyEn');
  const sourceUrl = t('sourceUrl');
  const reviewDue = dateOrNull(form, 'reviewDue');
  const problems = [
    ...(kind ? [] : ['kind_required']),
    ...(t('titleTa').length >= 3 && t('titleEn').length >= 3 ? [] : ['kb_title_required']),
    ...(bodyTa || bodyEn ? [] : ['source_text_required']),
    ...((bodyTa && bodyTa.length < 20) || (bodyEn && bodyEn.length < 20) ? ['kb_body_too_short'] : []),
    ...(t('publisher').length >= 2 ? [] : ['publisher_required']),
    ...(sourceUrl && !/^https:\/\/\S{4,500}$/.test(sourceUrl) ? ['source_url_invalid'] : []),
    ...(reviewDue ? [] : ['review_due_required']),
    ...(reviewDue && reviewDue <= colomboToday(now) ? ['review_date_must_be_ahead'] : []),
  ];
  if (problems.length > 0 || !kind || !reviewDue) return { input: null, problems };
  return {
    input: {
      kind,
      titleTa: t('titleTa'),
      titleEn: t('titleEn'),
      bodyTa: bodyTa || null,
      bodyEn: bodyEn || null,
      publisher: t('publisher'),
      sourceUrl: sourceUrl || null,
      publishedOn: dateOrNull(form, 'publishedOn'),
      changeNote: t('changeNote') || null,
      reviewDue,
    },
    problems,
  };
}

/** Approve, or send back with the reason the drafter is told. */
export function readSourceDecision(form: FormLike): Read<{ approve: boolean; reason?: string }> {
  const choice = text(form, 'decision');
  if (choice === 'approve') return { input: { approve: true }, problems: [] };
  if (choice !== 'return') return { input: null, problems: ['decision_required'] };
  const reason = text(form, 'reason');
  return reason.length >= 3 ? { input: { approve: false, reason }, problems: [] } : { input: null, problems: ['reason_required'] };
}

export function readReviewDue(form: FormLike, now: Date): Read<{ reviewDue: string }> {
  const reviewDue = dateOrNull(form, 'reviewDue');
  if (!reviewDue) return { input: null, problems: ['review_due_required'] };
  if (reviewDue <= colomboToday(now)) return { input: null, problems: ['review_date_must_be_ahead'] };
  return { input: { reviewDue }, problems: [] };
}

export function readReason(form: FormLike): Read<{ reason: string }> {
  const reason = text(form, 'reason');
  return reason.length >= 3 ? { input: { reason }, problems: [] } : { input: null, problems: ['reason_required'] };
}

/** FR-AIA-008: an error report is closed as fixed (the source changed) or no change, with what was done. */
export function readResolution(form: FormLike): Read<{ outcome: 'fixed' | 'no_change'; resolution: string }> {
  const outcome = text(form, 'outcome');
  const resolution = text(form, 'resolution');
  const problems = [
    ...(outcome === 'fixed' || outcome === 'no_change' ? [] : ['outcome_required']),
    ...(resolution.length >= 5 ? [] : ['resolution_required']),
  ];
  if (problems.length > 0) return { input: null, problems };
  return { input: { outcome: outcome as 'fixed' | 'no_change', resolution }, problems };
}

export function readReply(form: FormLike): Read<{ reply: string }> {
  const reply = text(form, 'reply');
  return reply.length >= 5 ? { input: { reply }, problems: [] } : { input: null, problems: ['handover_reply_required'] };
}

export function readQuestion(form: FormLike): Read<{ question: string; language: 'ta' | 'en' }> {
  const question = text(form, 'question');
  const language = text(form, 'language') === 'en' ? 'en' : 'ta';
  if (!question || question.length > 1000) return { input: null, problems: ['question_required'] };
  return { input: { question, language }, problems: [] };
}
