'use client';

import { SubmitButton } from '@/components/SubmitButton';
import { useLocale } from '@/lib/i18n/context';
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
  const locale = useLocale();

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
            <span lang={locale}>{locale === 'ta' ? 'விடுவிக்க' : 'Release case'}</span>
          </SubmitButton>
        ) : (
          <SubmitButton name="do" value="claim">
            <span lang={locale}>{locale === 'ta' ? 'பொறுப்பேற்க' : 'Claim case'}</span>
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
              <span lang={locale} className="text-sm font-semibold text-text">
                {locale === 'ta' ? 'தீர்மான முடிவு (கட்டாயமானது)' : 'Decision finding (required)'}
              </span>
            </legend>
            {isOutcomeError ? (
              <p id="error-outcome" className="text-xs font-semibold text-error">
                {locale === 'ta' ? bilingualProblemText('outcome_required').ta : bilingualProblemText('outcome_required').en}
              </p>
            ) : null}
            {outcomes.map((raw) => {
              const option = normalizeOutcome(raw);
              return (
                <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg border border-transparent p-2 text-sm hover:border-line hover:bg-surface">
                  <input
                    type="radio"
                    id={`input-outcome-${option.value}`}
                    name="outcome"
                    value={option.value}
                    required
                  />
                  <span lang={locale} className="font-semibold text-text">
                    {locale === 'ta' ? option.ta : option.en}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <label htmlFor="input-reason" className="flex flex-col gap-1 text-sm font-semibold">
            <span lang={locale} className="text-text">
              {locale === 'ta'
                ? 'காரணம் (தணிக்கைப் பதிவுக்குரியது மற்றும் இறுதியானது) *'
                : 'Reason (recorded in audit trail and final) *'}
            </span>
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
              {locale === 'ta' ? bilingualProblemText('reason_required').ta : bilingualProblemText('reason_required').en}
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
            <span lang={locale} className="font-semibold text-text">
              {locale === 'ta'
                ? 'இத்தீர்மான முடிவு முழுமையானது, ஆதாரமுடையது மற்றும் தணிக்கைப் பதிவுக்குத் தயாரானது என்பதை உறுதிப்படுத்துகிறேன்.'
                : 'I confirm this decision finding is complete, evidenced, and ready to be recorded in the audit trail.'}
            </span>
          </label>
          {isConfirmError ? (
            <p id="error-confirm" className="text-xs font-semibold text-error">
              {locale === 'ta' ? bilingualMessageFor('confirmation_required').ta : bilingualMessageFor('confirmation_required').en}
            </p>
          ) : null}

          <div>
            <SubmitButton>
              <span lang={locale}>{locale === 'ta' ? 'முடிவைப் பதிவுசெய்க' : 'Record the decision'}</span>
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </>
  );
}
