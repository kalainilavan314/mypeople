import type { Locale, TranslationDictionary } from '@/lib/i18n';
import { dueText, type DueStatus } from '@/features/privacy/register';

const TONES: Record<Exclude<DueStatus['kind'], 'closed'>, string> = {
  overdue: 'bg-error-bg text-error',
  due: 'bg-surface text-muted',
};

/** An open request's place against its due date, in words with a "!" when overdue, never colour alone. */
export function DueTag({ status, words, locale }: { status: DueStatus; words: TranslationDictionary['privacy']; locale: Locale }) {
  if (status.kind === 'closed') return null;
  const urgent = status.kind === 'overdue' || status.days === 0;
  return (
    <span
      lang={locale}
      className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
        status.kind === 'due' && status.days === 0 ? 'bg-warning-bg text-warning' : TONES[status.kind]
      }`}>
      {urgent ? <span aria-hidden="true">!</span> : null}
      {dueText(status, words)}
    </span>
  );
}
