import { SubmitButton } from '@/components/SubmitButton';
import { bilingualMessageFor, bilingualProblemText } from '@/lib/messages';

import { claimOrReleaseCase, decideCase } from './caseActions';

export type OutcomeOption =
  | { value: string; ta: string; en: string }
  | readonly [string, string]
  | readonly [string, string, string];

type Props = {
  kind: 'appeals' | 'duplicates';
  id: string;
  open: boolean;
  claimedByMe: boolean;
  outcomes: readonly OutcomeOption[];
  error?: string;
  problems?: string | string[];
};

function normalizeOutcome(item: OutcomeOption): { value: string; ta: string; en: string } {
  if (Array.isArray(item)) {
    if (item.length >= 3) {
      return { value: item[0], ta: item[1], en: item[2] };
    }
    return { value: item[0], ta: item[1], en: item[1] };
  }
  return item as { value: string; ta: string; en: string };
}

/** Claim, release and the final decision with its recorded reason. Shown only while the case is open. */
export function CaseControls({
  kind,
  id,
  open,
  claimedByMe,
  outcomes,
  error,
  problems,
}: Props) {
  if (!open) return null;

  const problemList = Array.isArray(problems) ? problems : typeof problems === 'string' && problems ? problems.split(',') : [];
  const isOutcomeError = error === 'outcome_required' || problemList.some((p) => p.startsWith('outcome'));
  const isReasonError = error === 'reason_required' || problemList.some((p) => p.startsWith('reason'));
  const isConfirmError = error === 'confirmation_required' || problemList.some((p) => p.startsWith('confirm'));

  return (
    <>
      <form action={claimOrReleaseCase} className="flex gap-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        {claimedByMe ? (
          <SubmitButton tone="secondary" name="do" value="release">
            <span className="flex flex-col items-center">
              <span lang="ta">விடுவிக்க</span>
              <span lang="en" className="text-xs font-normal opacity-90">Release case</span>
            </span>
          </SubmitButton>
        ) : (
          <SubmitButton name="do" value="claim">
            <span className="flex flex-col items-center">
              <span lang="ta">பொறுப்பேற்க</span>
              <span lang="en" className="text-xs font-normal opacity-90">Claim case</span>
            </span>
          </SubmitButton>
        )}
      </form>
      {claimedByMe ? (
        <form action={decideCase} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />

          <fieldset
            id="input-outcome"
            aria-invalid={isOutcomeError ? 'true' : undefined}
            aria-describedby={isOutcomeError ? 'error-outcome' : undefined}
            className="flex flex-col gap-2">
            <legend className="mb-1">
              <span lang="ta" className="block text-sm font-semibold text-text">தீர்மான முடிவு</span>
              <span lang="en" className="block text-xs font-normal text-muted">Decision finding (required)</span>
            </legend>
            {isOutcomeError ? (
              <p id="error-outcome" className="text-xs font-semibold text-error">
                {bilingualProblemText('outcome_required').ta} ({bilingualProblemText('outcome_required').en})
              </p>
            ) : null}
            {outcomes.map((raw) => {
              const option = normalizeOutcome(raw);
              return (
                <label key={option.value} className="flex min-h-11 items-start gap-3 rounded-lg border border-transparent p-2 text-sm hover:border-line hover:bg-surface">
                  <input
                    type="radio"
                    id={`input-outcome-${option.value}`}
                    name="outcome"
                    value={option.value}
                    required
                    className="mt-1"
                  />
                  <span className="flex flex-col">
                    <span lang="ta" className="font-semibold text-text">{option.ta}</span>
                    <span lang="en" className="text-xs text-muted">{option.en}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <label htmlFor="input-reason" className="flex flex-col gap-1 text-sm font-semibold">
            <span lang="ta" className="text-text">காரணம் (தணிக்கைப் பதிவுக்குரியது மற்றும் இறுதியானது) *</span>
            <span lang="en" className="text-xs font-normal text-muted">Reason (recorded in audit trail and final) *</span>
            <textarea
              id="input-reason"
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              rows={3}
              aria-invalid={isReasonError ? 'true' : undefined}
              aria-describedby={isReasonError ? 'error-reason' : undefined}
              className="rounded-lg border border-line p-2 text-base font-normal"
            />
          </label>
          {isReasonError ? (
            <p id="error-reason" className="text-xs font-semibold text-error">
              {bilingualProblemText('reason_required').ta} ({bilingualProblemText('reason_required').en})
            </p>
          ) : null}

          <label className="flex items-start gap-2 text-xs font-medium text-muted">
            <input
              type="checkbox"
              id="input-confirm"
              name="confirmOutcome"
              value="1"
              required
              aria-invalid={isConfirmError ? 'true' : undefined}
              aria-describedby={isConfirmError ? 'error-confirm' : undefined}
              className="mt-0.5 rounded border-line"
            />
            <span>
              <span lang="ta" className="block font-semibold text-text">
                இத்தீர்மான முடிவு முழுமையானது, ஆதாரமுடையது மற்றும் தணிக்கைப் பதிவுக்குத் தயாரானது என்பதை உறுதிப்படுத்துகிறேன்.
              </span>
              <span lang="en" className="block text-muted">
                I confirm this decision finding is complete, evidenced, and ready to be recorded in the audit trail.
              </span>
            </span>
          </label>
          {isConfirmError ? (
            <p id="error-confirm" className="text-xs font-semibold text-error">
              {bilingualMessageFor('confirmation_required').ta} ({bilingualMessageFor('confirmation_required').en})
            </p>
          ) : null}

          <div>
            <SubmitButton>
              <span className="flex flex-col items-center">
                <span lang="ta">முடிவைப் பதிவுசெய்க</span>
                <span lang="en" className="text-xs font-normal opacity-90">Record the decision</span>
              </span>
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </>
  );
}
