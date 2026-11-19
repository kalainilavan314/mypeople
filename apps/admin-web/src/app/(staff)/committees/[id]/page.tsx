import { ApiError, type CommitteeAdminDetail } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure } from '@/components/PageProblem';
import { BackLink, Detail, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import { closeCommittee, decideCommittee, grantCommitteeRole, removeCommitteeMember } from '@/features/committees/actions';
import {
  ACTIVITY_LABELS,
  COMMITTEE_TARGETS,
  KIND_LABELS,
  ROLES,
  ROLE_LABELS,
  STATE_LABELS,
  STATE_TONES,
  WING_LABELS,
} from '@/features/committees/forms';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'This committee is outside your areas, or your role cannot administer committees.';

const DECISION_FIELDS: readonly FieldSpec[] = [
  {
    name: 'decision',
    label: 'Decision',
    kind: 'radio',
    required: true,
    options: [
      { value: 'approve', label: 'Approve: it opens to members' },
      { value: 'reject', label: 'Reject with a reason' },
    ],
  },
  { name: 'reason', label: 'Reason, recorded with the decision', kind: 'textarea', required: true, maxLength: 500, showWhen: { field: 'decision', values: ['reject'] } },
];

const GRANT_FIELDS: readonly FieldSpec[] = [
  { name: 'memberCode', label: 'Member code', required: true, mono: true, maxLength: 40, hint: 'The person needs a verified identity and an active membership.' },
  {
    name: 'role',
    label: 'Role',
    kind: 'select',
    required: true,
    options: ROLES.map((role) => ({ value: role, label: `${ROLE_LABELS[role].ta} · ${ROLE_LABELS[role].en}` })),
  },
];

const REASON_FIELDS: readonly FieldSpec[] = [
  { name: 'reason', label: 'Reason, recorded with the change', kind: 'textarea', required: true, minLength: 3, maxLength: 500 },
];

/**
 * D23: one wing or committee: its state and scope, the Tier 5 decision, the roster with roles and
 * explicit role grants (FR-COM-003), and its activity in numbers (FR-COM-009). Never its content.
 */
export default function CommitteePage(props: PageProps<'/committees/[id]'>) {
  return (
    <>
      <BackLink href="/committees">Back to committees and wings</BackLink>
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <CommitteeDetail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CommitteeDetail({
  params,
  searchParams,
}: {
  params: PageProps<'/committees/[id]'>['params'];
  searchParams: PageProps<'/committees/[id]'>['searchParams'];
}) {
  await connection();
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const done = Array.isArray(query.done) ? query.done[0] : query.done;
  let detail: CommitteeAdminDetail;
  try {
    detail = await (await staffApi()).getAdminCommittee(id);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Committees and wings" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="This wing or committee was not found." />;
  }
  const { committee, roster, report } = detail;
  const areaNames = await loadAreaNames([committee.areaKey]);
  const tier5 = staff.permissions.has('system.configure');
  const members = roster.filter((entry) => entry.state === 'approved');
  const waiting = roster.filter((entry) => entry.state === 'applied');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader ta={committee.nameTa} en={committee.nameEn} />
      <Feedback done={done} />
      <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{committee.committeeRef}</span>
          <BilingualTag label={STATE_LABELS[committee.state]} tone={STATE_TONES[committee.state]} />
          <BilingualTag label={KIND_LABELS[committee.kind]} />
          <BilingualTag label={WING_LABELS[committee.wingType]} />
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Scope">{areaText(committee.areaKey, areaNames, 'en')}</Detail>
          {committee.wingNameEn ? <Detail label="Wing">{committee.wingNameEn}</Detail> : null}
          <Detail label="Proposed">{formatDate(committee.proposedAt)}</Detail>
          {committee.decidedAt ? <Detail label="Decided">{formatDateTime(committee.decidedAt)}</Detail> : null}
          {committee.decisionReason ? <Detail label="Decision reason">{committee.decisionReason}</Detail> : null}
          {committee.closeReason ? <Detail label="Closed because">{committee.closeReason}</Detail> : null}
        </dl>
        <BilingualText ta={committee.purposeTa} en={committee.purposeEn} />
      </section>

      {committee.state === 'proposed' ? (
        <Section id="decision" ta="Tier 5 முடிவு" en="Tier 5 decision" intro="It opens to members only after a Tier 5 approves it.">
          {tier5 ? (
            <SimpleForm
              id="committee-decision"
              action={decideCommittee}
              hidden={{ committeeId: committee.id }}
              fields={DECISION_FIELDS}
              submits={[{ label: 'Record decision' }]}
              targets={COMMITTEE_TARGETS}
            />
          ) : (
            <p className="text-sm text-muted">Waiting for a Tier 5.</p>
          )}
        </Section>
      ) : null}

      {committee.kind === 'wing' ? (
        <Section id="wing-committees" ta="இந்த அணியின் குழுக்கள்" en={`Committees in this wing (${detail.committees.length})`}>
          {detail.committees.length === 0 ? (
            <p className="text-sm text-muted">No committees yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {detail.committees.map((child) => (
                <li key={child.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/committees/${child.id}`} className={`font-mono font-semibold text-primary underline ${FOCUS_RING}`}>
                    {child.committeeRef}
                  </Link>
                  <BilingualTag label={STATE_LABELS[child.state]} tone={STATE_TONES[child.state]} />
                  <span>{child.nameEn}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {committee.kind === 'committee' ? (
        <>
          <Section
            id="roster"
            ta="உறுப்பினர் பட்டியலும் பொறுப்புகளும்"
            en={`Roster and roles (${members.length})`}
            intro="Names, member codes and roles only (RB-09). Every role change is logged with the person who made it.">
            {members.length === 0 ? (
              <p className="text-sm text-muted">Nobody yet. Name a coordinator below so members can be approved.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {members.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{entry.name}</span>
                      <span className="font-mono text-xs text-muted">{entry.memberCode}</span>
                      {entry.role ? <BilingualTag label={ROLE_LABELS[entry.role]} /> : null}
                      {entry.roleSetAt ? <span className="text-xs text-muted">role set {formatDate(entry.roleSetAt)}</span> : null}
                    </p>
                    {committee.state === 'active' ? (
                      <details>
                        <summary className={`cursor-pointer text-sm font-semibold text-primary ${FOCUS_RING}`}>Remove from the committee</summary>
                        <SimpleForm
                          id={`remove-${entry.id.slice(0, 8)}`}
                          action={removeCommitteeMember}
                          hidden={{ committeeId: committee.id, membershipId: entry.id }}
                          fields={REASON_FIELDS}
                          submits={[{ label: 'Remove', tone: 'danger' }]}
                          targets={COMMITTEE_TARGETS}
                        />
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-muted">{waiting.length} applications are waiting for the committee&apos;s coordinators.</p>
          </Section>

          {committee.state === 'active' ? (
            <SimpleForm
              id="committee-role"
              title="Give a committee role (FR-COM-003)"
              intro="An explicit grant: a coordinator holds committee.manage for this committee only."
              action={grantCommitteeRole}
              hidden={{ committeeId: committee.id }}
              fields={GRANT_FIELDS}
              submits={[{ label: 'Give the role' }]}
              targets={COMMITTEE_TARGETS}
            />
          ) : null}

          {report ? (
            <Section
              id="activity"
              ta="செயற்பாட்டு அறிக்கை"
              en="Activity report"
              intro={`Counts for this committee only, since ${formatDate(report.since)}.`}>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ACTIVITY_LABELS.map(([key, words]) => (
                  <div key={key} className="rounded-lg border border-line p-3">
                    <dt className="text-xs text-muted">
                      <span lang="ta" className="block">{words.ta}</span>
                      <span lang="en" className="block">{words.en}</span>
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums">{String(report[key as keyof typeof report])}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          ) : null}
        </>
      ) : null}

      {committee.state === 'active' && tier5 ? (
        <SimpleForm
          id="committee-close"
          title="Close this wing or committee"
          intro="Its records are kept. A wing closes only when none of its committees is open or proposed."
          action={closeCommittee}
          hidden={{ committeeId: committee.id }}
          fields={REASON_FIELDS}
          submits={[{ label: 'Close', tone: 'danger' }]}
          targets={COMMITTEE_TARGETS}
        />
      ) : null}
    </div>
  );
}
