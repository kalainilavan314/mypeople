const TONES = {
  waiting: 'bg-warning-bg text-warning',
  done: 'bg-success-bg text-success',
  refused: 'bg-error-bg text-error',
  neutral: 'bg-surface text-muted',
} as const;

export type TagTone = keyof typeof TONES;

/** A state in words, Tamil first with English under it; never colour alone (WCAG 1.4.1). */
export function BilingualTag({ label, tone = 'neutral' }: { label: { ta: string; en: string }; tone?: TagTone }) {
  return (
    <span className={`inline-flex w-fit flex-col rounded px-2 py-0.5 text-xs font-semibold leading-snug ${TONES[tone]}`}>
      <span lang="ta">{label.ta}</span>
      <span lang="en" className="font-medium">
        {label.en}
      </span>
    </span>
  );
}

/** A heading or label shown in both languages: Tamil first, English under it. */
export function BilingualText({ ta, en, className = '' }: { ta: string; en: string; className?: string }) {
  return (
    <span className={`flex flex-col ${className}`}>
      <span lang="ta" className="text-text">
        {ta}
      </span>
      <span lang="en" className="text-xs text-muted">
        {en}
      </span>
    </span>
  );
}
