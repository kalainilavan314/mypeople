import type { AccessCatalogue, ListedAssignment } from '@my-people/api-client';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { createAssignment, previewAssignment, revokeAssignment } from '@/features/organization/actions';
import { areaText, formatDate } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

const input = 'min-h-11 rounded-lg border border-line px-3 font-normal';

/**
 * W09: who holds which tier, area and permissions in the administrator's
 * areas, and assigning or ending a role. The API applies RB-02 and RB-03:
 * inside the administrator's own area, below their own tier, never to
 * themselves, only to a verified, active member (BR-097).
 */
export default function AccessPage(props: PageProps<'/access'>) {
  return (
    <>
      <PageHeader ta="பொறுப்புகள், பகுதிகள், அனுமதிகள்" en="Roles and access" brd="W09, FR-WEB-030 to 033, RB-01 to RB-07" />
      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <Access searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Access({ searchParams }: { searchParams: PageProps<'/access'>['searchParams'] }) {
  const query = await searchParams;
  const api = await staffApi();
  let catalogue: AccessCatalogue;
  let assignments: ListedAssignment[];
  try {
    [catalogue, assignments] = await Promise.all([api.getAccessCatalogue(), api.listAssignments('active')]);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {messageFor(error.code)}</p>;
    throw error;
  }
  return (
    <>
      <Feedback error={query.error} problems={query.problems} done={query.done} />
      <AssignForm catalogue={catalogue} />
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold">Active roles in your areas</h2>
        {assignments.length === 0 ? <p className="text-sm text-muted">None.</p> : null}
        <ul className="flex flex-col gap-2">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 text-sm">
              <p className="font-semibold">
                {assignment.fullName} <span className="font-mono text-muted">{assignment.memberCode}</span>
              </p>
              <p>
                Tier {assignment.tier} · {areaText(assignment.area)} · granted {formatDate(assignment.grantedAt)}
                {assignment.reviewDueAt ? ` · review due ${formatDate(assignment.reviewDueAt)}` : ''}
              </p>
              <p className="font-mono text-xs text-muted">{assignment.permissions.join(', ')}</p>
              <details>
                <summary className="min-h-11 cursor-pointer py-2 text-error">End this role</summary>
                <form action={revokeAssignment} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <label className="flex flex-col gap-1 font-semibold">
                    Reason
                    <input name="reason" required minLength={3} maxLength={500} className={input} />
                  </label>
                  <SubmitButton tone="danger">End role</SubmitButton>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function AssignForm({ catalogue }: { catalogue: AccessCatalogue }) {
  const permissions = Object.keys(catalogue.permissions).sort();
  return (
    <details className="rounded-xl border border-line bg-card p-4">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">Assign a role</summary>
      <form className="mt-3 flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1 font-semibold">
          Member ID of a verified, active member
          <input name="code" required minLength={3} className={`${input} font-mono`} />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 font-semibold">
            Tier
            <select name="tier" required className={input}>
              {catalogue.tiers.map((tier) => (
                <option key={tier.tier} value={tier.tier}>
                  Tier {tier.tier} ({tier.areaLevel})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-semibold">
            Area level
            <select name="level" className={input}>
              {['gn', 'ds', 'district', 'province', 'platform'].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-semibold">
            Area code
            <input name="areaCode" placeholder="LK41" className={`${input} font-mono`} />
          </label>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-semibold">Permissions (the tier must allow each; you must hold them)</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {permissions.map((permission) => (
              <label key={permission} className="flex min-h-11 items-center gap-2 font-mono text-xs">
                <input type="checkbox" name="permissions" value={permission} /> {permission}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 font-semibold">
          Note
          <input name="note" maxLength={500} className={input} />
        </label>
        <div className="flex flex-wrap gap-3">
          <SubmitButton tone="secondary" formAction={previewAssignment}>
            Preview
          </SubmitButton>
          <SubmitButton formAction={createAssignment}>Assign</SubmitButton>
        </div>
      </form>
    </details>
  );
}
