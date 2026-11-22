import { ApiError, type ManagedCertificate, type RenewalDueMember, type RenewalSummary } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { SimpleForm } from '@/components/SimpleForm';
import { issueCertificate } from '@/features/renewals/actions';
import { ISSUE_FIELDS } from '@/features/renewals/fields';
import {
  CERTIFICATE_TARGETS,
  KINDS,
  KIND_LABELS,
  PHASES,
  PHASE_LABELS,
  PHASE_TONES,
  STATUSES,
  STATUS_LABELS,
  STATUS_TONES,
  oneOf,
  searchRef,
} from '@/features/renewals/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS_RING}`;
const REFUSED = 'Renewals and certificates need certificate issuing and revoking (certificate.issue_revoke).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D25: members due for their yearly renewal in the viewer's areas, and the certificates issued to them. */
export default function RenewalsPage(props: PageProps<'/renewals'>) {
  return (
    <>
      <PageHeader ta="புதுப்பித்தலும் சான்றிதழ்களும்" en="Renewals and certificates" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Renewals searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={4} />}>
        <Certificates searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Renewals({ searchParams }: { searchParams: PageProps<'/renewals'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const phase = oneOf(PHASES, one(query.phase));

  let summary: RenewalSummary;
  let rows: RenewalDueMember[];
  try {
    const client = await staffApi();
    [summary, rows] = await Promise.all([client.getRenewalSummary(), client.listRenewalsDue(phase)]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Renewal and certificates" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The renewal list is not available." />;
  }
  const areaNames = await loadAreaNames(rows.map((row) => row.areaKey));

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Once a year each Active member confirms that their mobile number and area are still right. Renewal never asks for an NIC,
        passport or selfie again. Members are reminded 30 and 7 days before the due date; after it a {summary.graceDays}-day grace
        period runs, and then the membership lapses to Inactive until the member confirms. These periods are the recommended
        renewal policy and stay provisional until the sponsor decides it.
      </p>
      <dl className="grid gap-3 sm:grid-cols-4" aria-label="Members by renewal phase">
        {PHASES.map((key) => (
          <div key={key} className="rounded-2xl border border-line bg-card shadow-card p-4">
            <dt>
              <BilingualText ta={PHASE_LABELS[key].ta} en={PHASE_LABELS[key].en} />
            </dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-text">{summary[key]}</dd>
          </div>
        ))}
      </dl>
      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card shadow-card p-4">
        <label htmlFor="renewal-phase" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          Phase
          <select id="renewal-phase" name="phase" defaultValue={phase ?? ''} className={CONTROL}>
            <option value="">Every phase</option>
            {PHASES.map((key) => (
              <option key={key} value={key}>
                {PHASE_LABELS[key].ta} · {PHASE_LABELS[key].en}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
          Show
        </button>
        {phase ? (
          <Link href="/renewals" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
            Clear filter
          </Link>
        ) : null}
      </form>
      <RecordTable
        caption="Members by renewal phase"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.memberId}
        refHeader="Member ID"
        href={(row) => `/renewals?ref=${encodeURIComponent(row.memberCode)}#certificates`}
        linkText={(row) => row.memberCode}
        empty={phase ? 'No members in your areas are in this phase.' : 'No renewals are open in your areas yet.'}
        columns={[
          { header: 'Member', cell: (row) => <span className="text-text">{row.fullName}</span> },
          { header: 'Area', cell: (row) => <span className="text-xs text-muted">{areaText(row.areaKey, areaNames, locale)}</span> },
          { header: 'Phase', cell: (row) => <BilingualTag label={PHASE_LABELS[row.phase]} tone={PHASE_TONES[row.phase]} /> },
          {
            header: 'Due and grace',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>due {formatDate(row.dueOn)}</span>
                <span>grace ends {formatDate(row.graceEndsOn)}</span>
                {row.lapsedAt ? <span className="text-error">lapsed {formatDate(row.lapsedAt)}</span> : null}
              </span>
            ),
          },
          {
            header: 'Notices sent',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>30 days: {row.notice30At ? formatDate(row.notice30At) : 'not yet'}</span>
                <span>7 days: {row.notice7At ? formatDate(row.notice7At) : 'not yet'}</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

async function Certificates({ searchParams }: { searchParams: PageProps<'/renewals'>['searchParams'] }) {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const status = oneOf(STATUSES, one(query.status));
  const kind = oneOf(KINDS, one(query.kind));
  const ref = searchRef(one(query.ref));

  let rows: ManagedCertificate[];
  try {
    rows = await (await staffApi()).listCertificates({ status, kind, ref });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return null;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The certificate list is not available." />;
  }

  return (
    <>
      <Section
        id="certificates"
        ta="சான்றிதழ்கள்"
        en="Certificates"
        intro="Membership, event-participation and volunteer-service certificates of members in your areas, newest first. Anyone who scans a certificate's QR sees only its type, its issue date and whether it is valid, revoked or superseded, with the holder's name only while it is valid. No certificate ever shows an NIC or passport number.">
        <form role="search" method="get" action="/renewals#certificates" className="flex flex-wrap items-end gap-3">
          <label htmlFor="certificate-ref" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
            CT- reference or member ID
            <input id="certificate-ref" name="ref" defaultValue={ref ?? ''} maxLength={40} className={`${CONTROL} font-mono`} />
          </label>
          <label htmlFor="certificate-status" className="flex min-w-44 flex-col gap-1 text-sm font-semibold text-text">
            Status
            <select id="certificate-status" name="status" defaultValue={status ?? ''} className={CONTROL}>
              <option value="">Every status</option>
              {STATUSES.map((code) => (
                <option key={code} value={code}>
                  {STATUS_LABELS[code].ta} · {STATUS_LABELS[code].en}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="certificate-kind" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
            Kind
            <select id="certificate-kind" name="kind" defaultValue={kind ?? ''} className={CONTROL}>
              <option value="">Every kind</option>
              {KINDS.map((code) => (
                <option key={code} value={code}>
                  {KIND_LABELS[code].ta} · {KIND_LABELS[code].en}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
            Search
          </button>
          {ref || status || kind ? (
            <Link href="/renewals#certificates" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
              Clear search
            </Link>
          ) : null}
        </form>
        <RecordTable
          caption="Certificates"
          locale={locale}
          rows={rows}
          rowKey={(row) => row.id}
          refHeader="Certificate"
          href={(row) => `/renewals/certificates/${encodeURIComponent(row.certificateRef)}`}
          linkText={(row) => row.certificateRef}
          empty={ref || status || kind ? 'No certificates match this search.' : 'No certificates have been issued in your areas yet.'}
          columns={[
            {
              header: 'Holder',
              cell: (row) => (
                <span className="flex flex-col text-xs">
                  <span className="text-sm text-text">{row.holderName}</span>
                  <span className="font-mono text-muted">{row.memberCode}</span>
                </span>
              ),
            },
            { header: 'Kind', cell: (row) => <BilingualText ta={KIND_LABELS[row.kind].ta} en={KIND_LABELS[row.kind].en} /> },
            { header: 'Issued', cell: (row) => <span className="text-xs tabular-nums text-muted">{formatDate(row.issuedOn)}</span> },
            {
              header: 'Status',
              cell: (row) => (
                <span className="flex flex-col gap-1">
                  <BilingualTag label={STATUS_LABELS[row.status]} tone={STATUS_TONES[row.status]} />
                  {row.statusReason ? <span className="max-w-xs text-xs text-muted">{row.statusReason}</span> : null}
                </span>
              ),
            },
          ]}
        />
      </Section>
      <SimpleForm
        id="issue-certificate"
        title="Issue a certificate · சான்றிதழ் வழங்குதல்"
        intro="For a member in your areas. A membership certificate needs a verified identity and an Active membership; an event certificate needs attendance recorded at check-in; a volunteer certificate needs a completed assignment. If one is already valid, open it and reissue it with a reason instead."
        action={issueCertificate}
        fields={ISSUE_FIELDS}
        submits={[{ label: 'Issue certificate' }]}
        targets={CERTIFICATE_TARGETS}
      />
    </>
  );
}
