import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { closeVolunteerAssignment, offerVolunteerAssignment } from '@/features/operations/volunteerActions';
import { formatDateTime } from '@/lib/format';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const field = 'min-h-11 w-full rounded-lg border border-line bg-card px-3 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm font-semibold text-text';
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function VolunteerAssignmentsPage(props: PageProps<'/volunteer-assignments'>) {
  return <>
    <PageHeader ta="Volunteer assignments" en="Volunteer assignments" locale="en" />
    <Suspense fallback={<ConsoleLoading />}><AssignmentsConsole searchParams={props.searchParams} /></Suspense>
  </>;
}

async function AssignmentsConsole({ searchParams }: { searchParams: PageProps<'/volunteer-assignments'>['searchParams'] }) {
  const staff = await requireStaff();
  if (!staff.permissions.has('volunteers.manage')) notFound();
  const api = await staffApi();
  const [events, assignments, query] = await Promise.all([
    api.listVolunteerAssignmentEvents(), api.listVolunteerAssignments(), searchParams,
  ]);
  const open = assignments.filter((item) => item.state === 'offered' || item.state === 'accepted');
  const accepted = assignments.filter((item) => item.state === 'accepted').length;

  return <div className="flex flex-col gap-8" data-ui>
    <Feedback error={one(query.error)} problems={one(query.problems)} done={one(query.done)} />
    <section aria-labelledby="coverage-question" className="rounded-lg bg-card p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end">
        <div><h2 id="coverage-question" className="text-lg font-semibold text-text">Which event shifts still need a confirmed volunteer?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Offers require an active membership and a current optional-consent version. The server enforces your area on every action.</p></div>
        <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-surface px-2 py-4"><div className="px-3"><dt className="text-xs text-muted">Open offers</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{open.length}</dd></div><div className="px-3"><dt className="text-xs text-muted">Accepted</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{accepted}</dd></div><div className="px-3"><dt className="text-xs text-muted">Events available</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-text">{events.length}</dd></div></dl>
      </div>
    </section>

    <div className="grid items-start gap-8 xl:grid-cols-[minmax(20rem,0.7fr)_minmax(0,1.3fr)]">
      <section aria-labelledby="offer-heading" className="rounded-lg border border-line bg-card p-5">
        <h2 id="offer-heading" className="text-base font-semibold text-text">Offer a shift</h2>
        <p className="mt-1 text-sm text-muted">Use the exact member ID printed on the member card.</p>
        <form action={offerVolunteerAssignment} className="mt-5 flex flex-col gap-4">
          <label className={label}>Event<select className={field} name="eventId" required><option value="">Select an event</option>{events.map((event) => <option key={event.id} value={event.id}>{event.eventRef} · {event.titleEn}</option>)}</select></label>
          <label className={label}>Member ID<input className={`${field} font-mono uppercase`} name="memberCode" minLength={3} maxLength={40} autoComplete="off" required /></label>
          <label className={label}>Consent version<input className={field} name="consentVersion" maxLength={40} placeholder="For example, 1.0" required /></label>
          <label className={label}>Duty<select className={field} name="dutyType"><option value="registration">Registration</option><option value="scanning">Scanning</option><option value="member_assistance">Member assistance</option><option value="accessibility_support">Accessibility support</option><option value="logistics">Logistics</option><option value="coordination">Coordination</option><option value="administration">Administration</option></select></label>
          <label className={label}>Shift starts<input className={field} name="shiftStart" type="datetime-local" required /></label>
          <label className={label}>Shift ends<input className={field} name="shiftEnd" type="datetime-local" required /></label>
          <SubmitButton>Offer assignment</SubmitButton>
        </form>
      </section>

      <section aria-labelledby="assignments-heading">
        <div className="mb-3"><h2 id="assignments-heading" className="text-base font-semibold text-text">Assignment register</h2><p className="mt-1 text-sm text-muted">{assignments.length} assignments in your visible areas</p></div>
        {assignments.length === 0 ? <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">No volunteer assignments have been offered in your areas.</div> : <ul className="divide-y divide-line border-y border-line">{assignments.map((item) => <li key={item.id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-text">{item.memberName} · <span className="font-mono text-sm">{item.memberCode}</span></p><StateTag state={item.state} locale="en" /></div><p className="mt-1 text-sm text-muted">{item.eventTitleEn} · {item.dutyType.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-muted">{formatDateTime(item.shiftStart)} – {formatDateTime(item.shiftEnd)}</p></div>{item.state === 'offered' || item.state === 'accepted' ? <form action={closeVolunteerAssignment} className="grid gap-2 sm:grid-cols-[12rem_minmax(12rem,1fr)_auto]"><input type="hidden" name="assignmentId" value={item.id} /><select className={field} name="state"><option value="completed">Mark completed</option><option value="cancelled">Cancel assignment</option></select><label className="sr-only" htmlFor={`reason-${item.id}`}>Reason</label><input id={`reason-${item.id}`} className={field} name="reason" minLength={3} maxLength={1000} placeholder="Reason" required /><SubmitButton>Record</SubmitButton></form> : null}</li>)}</ul>}
      </section>
    </div>
  </div>;
}
