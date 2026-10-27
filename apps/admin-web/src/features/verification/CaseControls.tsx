import { SubmitButton } from '@/components/SubmitButton';

import { claimOrReleaseCase, decideCase } from './caseActions';

type Props = {
  kind: 'appeals' | 'duplicates';
  id: string;
  open: boolean;
  claimedByMe: boolean;
  outcomes: readonly (readonly [string, string])[];
};

/** Claim, release and the one final decision with its reason. Shown only while the case is open. */
export function CaseControls({ kind, id, open, claimedByMe, outcomes }: Props) {
  if (!open) return null;
  return (
    <>
      <form action={claimOrReleaseCase} className="flex gap-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        {claimedByMe ? (
          <SubmitButton tone="secondary" name="do" value="release">
            Release
          </SubmitButton>
        ) : (
          <SubmitButton name="do" value="claim">
            Claim
          </SubmitButton>
        )}
      </form>
      {claimedByMe ? (
        <form action={decideCase} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">Decision</legend>
            {outcomes.map(([value, label]) => (
              <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="outcome" value={value} required /> {label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Reason (recorded and final)
            <textarea name="reason" required minLength={3} maxLength={1000} rows={3} className="rounded-lg border border-line p-2 text-base font-normal" />
          </label>
          <SubmitButton>Record the decision</SubmitButton>
        </form>
      ) : null}
    </>
  );
}
