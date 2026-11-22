import { ApiError, type CommitteeAdmin } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import { decideCommittee } from '@/features/committees/actions';
import {
  COMMITTEE_TARGETS,
  KIND_LABELS,
  STATES,
  STATE_LABELS,
  STATE_TONES,
  WING_LABELS,
  WING_TYPES,
} from '@/features/committees/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS_RING}`;
const REFUSED = 'Committees and wings need the role administration permission (roles.assign) or Tier 5 system configuration.';

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

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * D23 Committees and wings administration: every wing and committee in the viewer's areas, and the
 * proposals waiting for a Tier 5. A wing or committee exists for members only once approved
 * (FR-COM-001); administrators see rosters and activity counts, never the committee's content (RB-08).
 */
export default function CommitteesPage(props: PageProps<'/committees'>) {
  return (
    <>
      <PageHeader ta="குழுக்களும் அணிகளும்" en="Committees and wings">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/committees/diaspora"
            className={`inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary ${FOCUS_RING}`}>
            Diaspora participation
          </Link>
          <ButtonLink href="/committees/new">Propose a wing or committee</ButtonLink>
        </div>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <CommitteeList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CommitteeList({ searchParams }: { searchParams: PageProps<'/committees'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const state = STATES.find((item) => item === one(query.state));
  const wingType = WING_TYPES.find((item) => item === one(query.wing));

  let rows: CommitteeAdmin[];
  let proposed: CommitteeAdmin[];
  try {
    const client = await staffApi();
    [rows, proposed] = await Promise.all([
      client.listAdminCommittees({ state, wingType }),
      client.listAdminCommittees({ state: 'proposed' }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Committees and wings" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The committee list is not available." />;
  }
  const areaNames = await loadAreaNames([...rows, ...proposed].map((row) => row.areaKey));
  const approves = staff.permissions.has('system.configure');

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Youth, women&apos;s, farmers&apos;, fishers&apos;, professional and diaspora wings, and the committees inside them. Members
        apply to a committee and its coordinator decides. Committee spaces have no direct messages and no open feed.
      </p>

      <Section
        id="waiting-approval"
        ta="Tier 5 அங்கீகாரத்துக்குக் காத்திருப்பவை"
        en={`Waiting for Tier 5 approval (${proposed.length})`}
        intro={approves ? 'Approve to open it to members, or reject with a reason.' : 'A Tier 5 approves each one; you can see what is waiting.'}>
        {proposed.length === 0 ? (
          <p className="text-sm text-muted">Nothing is waiting.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {proposed.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/committees/${item.id}`} className={`font-mono font-semibold text-primary underline ${FOCUS_RING}`}>
                    {item.committeeRef}
                  </Link>
                  <BilingualTag label={KIND_LABELS[item.kind]} />
                  <BilingualTag label={WING_LABELS[item.wingType]} />
                  <span className="text-xs text-muted">
                    {areaText(item.areaKey, areaNames, 'en')} · proposed {formatDate(item.proposedAt)}
                  </span>
                </p>
                <BilingualText ta={item.nameTa} en={item.nameEn} />
                <p lang="ta" className="whitespace-pre-wrap text-text">{item.purposeTa}</p>
                <p lang="en" className="whitespace-pre-wrap text-muted">{item.purposeEn}</p>
                {approves ? (
                  <SimpleForm
                    id={`decision-${item.id.slice(0, 8)}`}
                    action={decideCommittee}
                    hidden={{ committeeId: item.id, returnTo: 'list' }}
                    fields={DECISION_FIELDS}
                    submits={[{ label: 'Record decision' }]}
                    targets={COMMITTEE_TARGETS}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card shadow-card p-4">
        <label htmlFor="committee-state" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          State
          <select id="committee-state" name="state" defaultValue={state ?? ''} className={CONTROL}>
            <option value="">All states</option>
            {STATES.map((code) => (
              <option key={code} value={code}>
                {STATE_LABELS[code].ta} · {STATE_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="committee-wing" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          Wing
          <select id="committee-wing" name="wing" defaultValue={wingType ?? ''} className={CONTROL}>
            <option value="">All wings</option>
            {WING_TYPES.map((code) => (
              <option key={code} value={code}>
                {WING_LABELS[code].ta} · {WING_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
          Apply filters
        </button>
        {state || wingType ? (
          <Link href="/committees" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
            Clear filters
          </Link>
        ) : null}
      </form>

      <RecordTable
        caption="Wings and committees"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Reference"
        href={(row) => `/committees/${row.id}`}
        linkText={(row) => row.committeeRef}
        empty={state || wingType ? 'No wings or committees match these filters.' : 'No wings or committees in your areas yet.'}
        columns={[
          { header: 'State', cell: (row) => <BilingualTag label={STATE_LABELS[row.state]} tone={STATE_TONES[row.state]} /> },
          { header: 'Name', cell: (row) => <BilingualText ta={row.nameTa} en={row.nameEn} className="max-w-xs" /> },
          {
            header: 'Wing',
            cell: (row) => (
              <span className="flex flex-col text-xs">
                <span className="text-text">{KIND_LABELS[row.kind].en}</span>
                <span className="text-muted">{WING_LABELS[row.wingType].en}</span>
              </span>
            ),
          },
          { header: 'Area', cell: (row) => <span className="text-xs text-muted">{areaText(row.areaKey, areaNames, 'en')}</span> },
          {
            header: 'Members',
            cell: (row) =>
              row.kind === 'committee' ? (
                <span className="flex flex-col text-xs tabular-nums">
                  <span className="text-text">{row.members} members</span>
                  <span className="text-muted">{row.applications} applications waiting</span>
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
        ]}
      />
    </div>
  );
}
