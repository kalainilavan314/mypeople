import type { MembershipFile } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { changeMembership } from '@/features/members/actions';
import { formatDateTime, words } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

// The API's transitions and proposed reason codes (services/api/app/modules/membership/rules.py).
const CHANGES: Record<string, { from: string[]; reasons: string[] }> = {
  activate: { from: ['pending', 'inactive'], reasons: ['identity_verified', 'rejoined', 'other'] },
  suspend: { from: ['active'], reasons: ['conduct_investigation', 'security_concern', 'member_request', 'other'] },
  reinstate: { from: ['suspended'], reasons: ['investigation_closed', 'appeal_upheld', 'member_request', 'other'] },
  inactivate: { from: ['pending', 'active', 'suspended'], reasons: ['member_request', 'deceased', 'duplicate_account', 'other'] },
};

/** D06: a member's membership state, every change with its reason, and the changes allowed now. */
export default function MembershipFilePage(props: PageProps<'/membership/[memberId]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading</p>}>
      <FileView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function FileView({ params, searchParams }: Pick<PageProps<'/membership/[memberId]'>, 'params' | 'searchParams'>) {
  const { memberId } = await params;
  const query = await searchParams;
  let file: MembershipFile;
  try {
    file = await (await staffApi()).getMembership(memberId);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  const allowed = Object.entries(CHANGES).filter(([, change]) => change.from.includes(file.state));

  return (
    <>
      <PageHeader ta="உறுப்புரிமைக் கோப்பு" en="Membership file" brd="D06">
        <Link href="/membership" className="text-sm text-primary underline">
          Back
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />
      <section className="flex flex-col gap-1 rounded-xl border border-line bg-card p-4 text-sm">
        <p>
          <StateTag state={file.state} /> {file.reasonCode ? `· ${words(file.reasonCode)}` : ''} · since {formatDateTime(file.changedAt)}
        </p>
        <p>Identity: {file.identityVerified ? '✓ verified' : '! not verified (activation needs a verified identity)'}</p>
      </section>
      {allowed.length > 0 ? (
        <form action={changeMembership} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
          <input type="hidden" name="memberId" value={memberId} />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Change and reason
            <select name="change" required defaultValue="" className="min-h-11 rounded-lg border border-line px-2 font-normal">
              <option value="" disabled>
                Choose…
              </option>
              {allowed.map(([action, change]) => (
                <optgroup key={action} label={words(action)}>
                  {change.reasons.map((reason) => (
                    <option key={reason} value={`${action}:${reason}`}>
                      {words(action)}: {words(reason)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Note (needed for “other”)
            <textarea name="note" maxLength={500} rows={2} className="rounded-lg border border-line p-2 text-base font-normal" />
          </label>
          <SubmitButton>Record the change</SubmitButton>
        </form>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold">History</h2>
        {file.history.length === 0 ? <p className="text-sm text-muted">No changes yet: pending since sign-up.</p> : null}
        <ul className="flex flex-col gap-2">
          {file.history.map((change) => (
            <li key={change.changedAt} className="rounded-xl border border-line bg-card p-3 text-sm">
              {words(change.action)}: {change.fromState} → {change.toState} · {words(change.reasonCode)} · {formatDateTime(change.changedAt)}
              {change.note ? <span className="block text-muted">{change.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
