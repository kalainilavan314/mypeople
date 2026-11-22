import { ApiError, type ManagedOfficialStatement, type OfficialSigningStatus } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, FOCUS_RING, NotSwitchedOn } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { SigningStatus } from '@/features/publishing/SigningStatus';
import { SIGNED_LABEL, STATES, STATE_LABELS, STATE_TONES, UNSIGNED_LABEL } from '@/features/publishing/forms';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS_RING}`;
const REFUSED = 'Official publishing needs content signing (content.sign_publish) or Tier 5 system configuration.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D30: drafts, signed and withdrawn statements, whether signing is available, and the publishers (Tier 5). */
export default function PublishingPage(props: PageProps<'/publishing'>) {
  return (
    <>
      <PageHeader ta="அதிகாரபூர்வ வெளியீடும் கையொப்பமும்" en="Official publishing and signing">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/publishing/publishers"
            className={`inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary ${FOCUS_RING}`}>
            Publishers
          </Link>
          <ButtonLink href="/publishing/new">New statement</ButtonLink>
        </div>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <StatementList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function StatementList({ searchParams }: { searchParams: PageProps<'/publishing'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const state = STATES.find((item) => item === one(query.state));

  let rows: ManagedOfficialStatement[];
  let signing: OfficialSigningStatus;
  try {
    const client = await staffApi();
    [rows, signing] = await Promise.all([client.listManagedOfficialStatements(state ? [state] : undefined), client.getOfficialSigningStatus()]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Official publishing" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The statement list is not available." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} error={one(query.error)} problems={one(query.problems)} />
      <SigningStatus status={signing} canSign={staff.permissions.has('content.sign_publish')} />
      <p className="text-sm text-muted">
        A statement is official only once a registered publisher signs it. After that it never changes: a correction is a new signed
        version with its reason, and withdrawing keeps the record and tells everyone who checks it.
      </p>
      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card shadow-card p-4">
        <label htmlFor="official-state" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          State
          <select id="official-state" name="state" defaultValue={state ?? ''} className={CONTROL}>
            <option value="">All states</option>
            {STATES.map((code) => (
              <option key={code} value={code}>
                {STATE_LABELS[code].ta} · {STATE_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
          Apply filter
        </button>
        {state ? (
          <Link href="/publishing" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
            Clear filter
          </Link>
        ) : null}
      </form>
      <RecordTable
        caption="Official statements"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Reference"
        href={(row) => `/publishing/${row.id}`}
        linkText={(row) => row.statementRef}
        empty={state ? 'No statements in this state.' : 'No statements yet. Start with a new statement.'}
        columns={[
          { header: 'State', cell: (row) => <BilingualTag label={STATE_LABELS[row.state]} tone={STATE_TONES[row.state]} /> },
          {
            header: 'Statement',
            cell: (row) => {
              const latest = row.revisions.at(-1);
              return (
                <BilingualText
                  ta={latest?.titleTa ?? (row.draftTitleTa || '(no Tamil title yet)')}
                  en={latest?.titleEn ?? (row.draftTitleEn || '(no English title yet)')}
                  className="max-w-xs"
                />
              );
            },
          },
          {
            header: 'Check code and signature',
            cell: (row) =>
              row.checkCode ? (
                <span className="flex flex-col gap-1 text-xs">
                  <span className="font-mono text-text">{row.checkCode}</span>
                  <BilingualTag label={row.signed ? SIGNED_LABEL : UNSIGNED_LABEL} tone={row.signed ? 'done' : 'refused'} />
                </span>
              ) : (
                <span className="text-xs text-muted">Not signed yet</span>
              ),
          },
          {
            header: 'Versions and last change',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>{row.revisions.length === 0 ? 'Draft' : `${row.revisions.length} signed version(s)`}</span>
                <span>{formatDateTime(row.updatedAt)}</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
