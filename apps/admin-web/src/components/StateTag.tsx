type Tone = 'done' | 'waiting' | 'neutral' | 'refused';

const TONES: Record<Tone, { mark: string; className: string }> = {
  done: { mark: '✓', className: 'bg-success-bg text-success' },
  waiting: { mark: '…', className: 'bg-warning-bg text-warning' },
  neutral: { mark: '•', className: 'bg-surface text-muted' },
  refused: { mark: '!', className: 'bg-error-bg text-error' },
};

const STATE_TONES: Record<string, Tone> = {
  verified: 'done',
  approved: 'done',
  active: 'done',
  duplicate_confirmed: 'refused',
  not_duplicate: 'done',
  upheld: 'neutral',
  overturned: 'done',
  submitted: 'waiting',
  in_review: 'waiting',
  open: 'waiting',
  pending: 'waiting',
  needs_update: 'waiting',
  unable_to_verify: 'refused',
  suspended: 'refused',
  revoked: 'neutral',
  inactive: 'neutral',
};

/** A state with a mark and words, never colour alone (WCAG 1.4.1). */
export function StateTag({ state }: { state: string }) {
  const tone = TONES[STATE_TONES[state] ?? 'neutral'];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${tone.className}`}>
      <span aria-hidden="true">{tone.mark}</span>
      {state.replace(/_/g, ' ')}
    </span>
  );
}
