import { ApiError, type RosterShiftFile } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { ASSIGNMENT_LABELS, ROSTER_TARGETS } from '@/features/elections/roster';
import { cancelShift, messageShift, offerShift } from '@/features/elections/rosterActions';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This shift does not exist or is outside your areas.';
const REFUSED = 'The election duty roster needs the roster permission (election.roster.manage).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FR-ELX-006, 007: one shift: the people offered it, offers by member ID, a message, and cancelling. */
export default function ShiftPage(props: PageProps<'/elections/[id]/roster/[shift]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={6} />}>
      <ShiftView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ShiftView({ params, searchParams }: Pick<PageProps<'/elections/[id]/roster/[shift]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id, shift: shiftId } = await params;
  const query = await searchParams;
  const backLink = <BackLink href={UUID.test(id) ? `/elections/${id}/roster` : '/roster'}>Back to the duty roster</BackLink>;
  if (!UUID.test(id) || !UUID.test(shiftId)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let shift: RosterShiftFile;
  try {
    shift = await (await staffApi()).getRosterShift(shiftId);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="The election duty roster" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }
  const areaNames = await loadAreaNames([shift.areaKey]);
  const open = shift.state === 'open';
  const hidden = { periodId: id, shiftId: shift.id };

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{shift.periodRef}</span>
          <BilingualTag label={open ? { ta: 'திறந்துள்ளது', en: 'Open' } : { ta: 'இரத்து செய்யப்பட்டது', en: 'Cancelled' }} tone={open ? 'waiting' : 'neutral'} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{shift.roleTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {shift.roleEn}
          </span>
        </h1>
        <div className="text-sm text-muted">
          <Both ta={shift.siteTa} en={shift.siteEn} />
          <p>
            {formatDateTime(shift.startsAt)} to {formatDateTime(shift.endsAt)} · {areaText(shift.areaKey, areaNames, 'en')} · {shift.accepted} of {shift.places} accepted
          </p>
        </div>
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Section id="people" ta="பணியாளர்கள்" en={`People offered this shift (${shift.assignments.length})`} intro="Check-in records a time and, optionally, that the person confirmed the site. No location is recorded.">
          {shift.assignments.length === 0 ? (
            <p className="text-sm text-muted">No one has been offered this shift yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {shift.assignments.map((assignment) => (
                <li key={assignment.id} className="flex flex-col gap-1 py-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text">{assignment.volunteerName}</span>
                    <span className="font-mono text-xs text-muted">{assignment.memberCode}</span>
                    <BilingualTag label={ASSIGNMENT_LABELS[assignment.state] ?? { ta: assignment.state, en: assignment.state }} tone={assignment.state === 'accepted' ? 'done' : assignment.state === 'offered' ? 'waiting' : 'neutral'} />
                  </p>
                  <p className="text-xs tabular-nums text-muted">
                    {assignment.respondedAt ? `answered ${formatDateTime(assignment.respondedAt)}` : 'no answer yet'}
                    {assignment.checkedInAt ? ` · checked in ${formatDateTime(assignment.checkedInAt)}${assignment.siteConfirmed ? ' (site confirmed)' : ''}` : ''}
                    {assignment.checkedOutAt ? ` · checked out ${formatDateTime(assignment.checkedOutAt)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <aside aria-label="Shift actions" className="flex flex-col gap-4">
          {open ? (
            <SimpleForm
              id="offer"
              title="Offer the shift"
              intro="Use the member ID printed on the card. The member must be active and inside the shift's area."
              action={offerShift}
              hidden={hidden}
              fields={[{ name: 'memberCode', label: 'Member ID', required: true, minLength: 3, maxLength: 30, mono: true, wide: true }]}
              submits={[{ label: 'Offer shift' }]}
              targets={ROSTER_TARGETS}
            />
          ) : null}
          {open ? (
            <SimpleForm
              id="message"
              title="Operational message"
              intro="Sent to everyone offered or accepted on this shift."
              action={messageShift}
              hidden={hidden}
              fields={[
                { name: 'bodyTa', label: 'Message in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 3, maxLength: 800 },
                { name: 'bodyEn', label: 'Message in English', kind: 'textarea', lang: 'en', required: true, minLength: 3, maxLength: 500 },
              ]}
              submits={[{ label: 'Send message', tone: 'secondary' }]}
              targets={ROSTER_TARGETS}
            />
          ) : null}
          {open ? (
            <SimpleForm
              id="cancel"
              title="Cancel the shift"
              intro="Everyone offered or accepted is told."
              action={cancelShift}
              hidden={hidden}
              fields={[{ name: 'reason', label: 'Reason', kind: 'textarea', required: true, minLength: 3, maxLength: 500 }]}
              submits={[{ label: 'Cancel the shift', tone: 'danger' }]}
              targets={ROSTER_TARGETS}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
