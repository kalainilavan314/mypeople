'use client';

import { useLocale } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';

type Tone = 'done' | 'waiting' | 'neutral' | 'refused';

const TONES: Record<Tone, { className: string }> = {
  done: { className: 'bg-success-bg text-success' },
  waiting: { className: 'bg-warning-bg text-warning' },
  neutral: { className: 'bg-surface text-muted' },
  refused: { className: 'bg-error-bg text-error' },
};
const STATE_TONES: Record<string, Tone> = {
  verified: 'done',
  approved: 'done',
  active: 'done',
  published: 'done',
  sent: 'done',
  enabled: 'done',
  kept: 'done',
  duplicate_confirmed: 'refused',
  not_duplicate: 'done',
  upheld: 'neutral',
  overturned: 'done',
  submitted: 'waiting',
  in_review: 'waiting',
  open: 'waiting',
  pending: 'waiting',
  pending_approval: 'waiting',
  pending_review: 'waiting',
  approval_pending: 'waiting',
  reconciled: 'waiting',
  needs_correction: 'waiting',
  rejected: 'refused',
  scheduled: 'waiting',
  held: 'waiting',
  on_hold: 'waiting',
  needs_update: 'waiting',
  draft: 'neutral',
  blurred: 'neutral',
  disabled: 'neutral',
  unable_to_verify: 'refused',
  suspended: 'refused',
  cancelled: 'refused',
  removed: 'refused',
  revoked: 'neutral',
  inactive: 'neutral',
  declared: 'done',
  ended: 'neutral',
  withdrawn: 'neutral',
  completed: 'done',
  refused: 'refused',
};

const STATE_LABELS_TA: Record<string, string> = {
  verified: 'சரிபார்க்கப்பட்டது',
  approved: 'அங்கீகரிக்கப்பட்டது',
  active: 'செயலில் உள்ளது',
  published: 'வெளியிடப்பட்டது',
  sent: 'அனுப்பப்பட்டது',
  enabled: 'செயல்படுத்தப்பட்டது',
  kept: 'தக்கவைக்கப்பட்டது',
  duplicate_confirmed: 'போலி உறுதிசெய்யப்பட்டது',
  not_duplicate: 'போலி இல்லை',
  upheld: 'உறுதி செய்யப்பட்டது',
  overturned: 'ரத்து செய்யப்பட்டது',
  submitted: 'சமர்ப்பிக்கப்பட்டது',
  in_review: 'ஆய்வில் உள்ளது',
  open: 'திறந்துள்ளது',
  pending: 'நிலுவையில் உள்ளது',
  pending_approval: 'ஒப்புதலுக்காகக் காத்திருக்கிறது',
  scheduled: 'திட்டமிடப்பட்டது',
  held: 'நிறுத்திவைக்கப்பட்டுள்ளது',
  needs_update: 'திருத்தம் தேவைப்படுகிறது',
  draft: 'வரைவு',
  blurred: 'மங்கலாக்கப்பட்டது',
  disabled: 'முடக்கப்பட்டது',
  unable_to_verify: 'சரிபார்க்க இயலவில்லை',
  suspended: 'இடைநிறுத்தப்பட்டது',
  cancelled: 'இரத்து செய்யப்பட்டது',
  removed: 'நீக்கப்பட்டது',
  revoked: 'திரும்பப் பெறப்பட்டது',
  inactive: 'செயலற்றது',
  declared: 'அறிவிக்கப்பட்டது',
  ended: 'முடிவுற்றது',
  withdrawn: 'மீளப்பெறப்பட்டது',
  completed: 'நிறைவேற்றப்பட்டது',
  refused: 'நிராகரிக்கப்பட்டது',
};

/** A state with words, never colour alone (WCAG 1.4.1). Localized cleanly per active staff language. */
export function StateTag({ state, locale: requestedLocale }: { state: string; locale?: Locale }) {
  const contextLocale = useLocale();
  const locale = requestedLocale ?? contextLocale;
  const tone = TONES[STATE_TONES[state] ?? 'neutral'];
  const label = locale === 'ta' && STATE_LABELS_TA[state] ? STATE_LABELS_TA[state] : state.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${tone.className}`}>
      <span lang={locale}>{label}</span>
    </span>
  );
}
