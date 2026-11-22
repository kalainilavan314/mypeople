import { ApiError, type ManagedBudgetCycleSummary } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, NotSwitchedOn } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { CONSULTATION_LABEL, FUND_KIND_LABELS, MANAGE, PHASE_LABELS, STATUS_LABELS, STATUS_TONES, formatRupees } from '@/features/budgeting/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Participatory budgeting needs budgeting management (pb.manage), certification (pb.certify) or the Treasurer’s finance approval (finance.approve).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D19: budgeting cycles in the viewer's areas, newest first. */
export default function BudgetingPage(props: PageProps<'/budgeting'>) {
  return (
    <>
      <PageHeader ta="பங்கேற்பு வரவுசெலவு" en="Participatory budgeting">
        <Suspense fallback={null}>
          <NewCycleButton />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <CycleList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewCycleButton() {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  return staff.permissions.has(MANAGE) ? <ButtonLink href="/budgeting/new">New cycle</ButtonLink> : null;
}

async function CycleList({ searchParams }: { searchParams: PageProps<'/budgeting'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;

  let rows: ManagedBudgetCycleSummary[];
  try {
    rows = await (await staffApi()).listManagedBudgetCycles();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Participatory budgeting" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The budgeting cycles are not available." />;
  }
  const areaNames = await loadAreaNames(rows.map((row) => row.areaKey));

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="flex flex-col gap-1 rounded-2xl border border-line bg-card shadow-card p-4 text-sm">
        <span lang="ta" className="font-semibold text-text">{CONSULTATION_LABEL.ta}</span>
        <span lang="en" className="text-muted">{CONSULTATION_LABEL.en}</span>
      </p>
      <p className="text-sm text-muted">
        Members vote on approved local projects for a set budget. Rules are published before voting and locked while it runs;
        ballots never carry the voter; two different people certify the count; allocations go to the finance records.
      </p>
      <RecordTable
        caption="Budgeting cycles"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Reference"
        href={(row) => `/budgeting/${row.id}`}
        linkText={(row) => row.cycleRef}
        empty="No budgeting cycles in your areas yet."
        columns={[
          {
            header: 'Status',
            cell: (row) => (
              <span className="flex flex-col gap-1">
                <BilingualTag label={STATUS_LABELS[row.status]} tone={STATUS_TONES[row.status]} />
                <span className="text-xs text-muted">{PHASE_LABELS[row.phase].en}</span>
              </span>
            ),
          },
          { header: 'Cycle', cell: (row) => <BilingualText ta={row.titleTa} en={row.titleEn} className="max-w-xs" /> },
          {
            header: 'Budget and fund',
            cell: (row) => (
              <span className="flex flex-col text-xs">
                <span className="tabular-nums text-text">{formatRupees(row.budget)}</span>
                <span className="text-muted">{FUND_KIND_LABELS[row.fundKind].en}</span>
              </span>
            ),
          },
          { header: 'Area', cell: (row) => <span className="text-xs">{areaText(row.areaKey, areaNames, 'en')}</span> },
          {
            header: 'Voting',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>opens {formatDateTime(row.votingOpensAt)}</span>
                <span>closes {formatDateTime(row.votingClosesAt)}</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
