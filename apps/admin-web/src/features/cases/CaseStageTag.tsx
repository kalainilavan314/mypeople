import { stageLabel } from './stages';

const TONES = {
  open: 'bg-warning-bg text-warning',
  resolved: 'bg-success-bg text-success',
  declined: 'bg-error-bg text-error',
  linked: 'bg-surface text-muted',
} as const;

/** A case stage in words, Tamil first with English under it; never colour alone (WCAG 1.4.1). */
export function CaseStageTag({ stage }: { stage: string }) {
  const label = stageLabel(stage);
  const tone = stage === 'resolved' || stage === 'declined' || stage === 'linked' ? TONES[stage] : TONES.open;
  return (
    <span className={`inline-flex w-fit flex-col rounded px-2 py-0.5 text-xs font-semibold leading-snug ${tone}`}>
      <span lang="ta">{label.ta}</span>
      <span lang="en" className="font-medium">
        {label.en}
      </span>
    </span>
  );
}

/** A case past its stage's time limit (FR-WEB-028). */
export function OverdueTag() {
  return (
    <span className="inline-flex w-fit flex-col rounded bg-error-bg px-2 py-0.5 text-xs font-semibold leading-snug text-error">
      <span lang="ta">! காலம் கடந்தது</span>
      <span lang="en" className="font-medium">
        Overdue
      </span>
    </span>
  );
}
