import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { ConsolePagination } from '@/components/ConsolePagination';
import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { StateTag } from '@/components/StateTag';
import { CONSOLE_PAGE_SIZE, consolePage } from '@/lib/pagination';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'SUBMITTED', label: 'Submitted (Waiting Review)' },
  { value: 'PENDING_REVIEW', label: 'Claimed (Under Review)' },
  { value: 'APPROVAL_PENDING', label: 'Reconciled (Awaiting Approval)' },
  { value: 'VERIFIED', label: 'Verified & Issued' },
  { value: 'NEEDS_CORRECTION', label: 'Needs Correction' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ON_HOLD', label: 'Under Extended Review' },
];

const RISK_FLAG_OPTIONS = [
  { value: '', label: 'All Cases' },
  { value: 'duplicate_bank_reference', label: 'Duplicate Bank Reference' },
  { value: 'enhanced_review_threshold', label: 'Enhanced Review (>= 100k LKR)' },
  { value: 'third_party_payment', label: 'Third-Party Payer' },
];

export default async function FinanceQueuePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <>
      <PageHeader ta="Finance queue & slip ledger" en="Finance queue & slip ledger" locale="en" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <FinanceQueue searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function FinanceQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;

  const status = one(params.status) || undefined;
  const month = one(params.month) || undefined;
  const riskFlag = one(params.risk_flag) || undefined;
  const reference = one(params.reference)?.trim() || undefined;
  const mine = one(params.mine) === '1';
  const page = consolePage(params.page);

  const currentMonth = month || new Date().toISOString().slice(0, 7);

  const api = await staffApi();
  let contributionsList;
  try {
    contributionsList = await api.listFinanceContributions({
      status,
      month,
      riskFlag,
      reference,
      mine,
      limit: CONSOLE_PAGE_SIZE + 1,
      offset: (page - 1) * CONSOLE_PAGE_SIZE,
    });
  } catch (err) {
    return (
      <div className="rounded-xl border border-error/20 bg-error-bg p-4 text-sm text-error">
        Unable to load finance queue: {(err as Error).message}
      </div>
    );
  }

  const hasMore = contributionsList.items.length > CONSOLE_PAGE_SIZE;
  const items = contributionsList.items.slice(0, CONSOLE_PAGE_SIZE);

  const canExport = staff.permissions.has('finance.export');

  // Compute metric cards from items
  const countSubmitted = items.filter((i) => i.status === 'SUBMITTED' || i.status === 'PENDING_REVIEW').length;
  const countReconciled = items.filter((i) => i.status === 'APPROVAL_PENDING').length;
  const countVerified = items.filter((i) => i.status === 'VERIFIED').length;
  const countFlagged = items.filter((i) => i.riskFlags && i.riskFlags.length > 0).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Metric summary banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs font-medium text-muted">Shown: awaiting review</p>
          <p className="mt-1 text-2xl font-bold text-text">{countSubmitted}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs font-medium text-muted">Shown: awaiting approval</p>
          <p className="mt-1 text-2xl font-bold text-warning">{countReconciled}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs font-medium text-muted">Shown: verified & issued</p>
          <p className="mt-1 text-2xl font-bold text-success">{countVerified}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs font-medium text-muted">Shown: risk flagged</p>
          <p className="mt-1 text-2xl font-bold text-error">{countFlagged}</p>
        </div>
      </div>

      {/* Filter and Export Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
        <form className="flex flex-wrap items-end gap-3" role="search">
          <label className="flex flex-col gap-1 text-xs font-semibold text-text">
            <span>Status</span>
            <select
              name="status"
              defaultValue={status ?? ''}
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm">
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-text">
            <span>Month</span>
            <input
              type="month"
              name="month"
              defaultValue={currentMonth}
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-text">
            <span>Risk Flags</span>
            <select
              name="risk_flag"
              defaultValue={riskFlag ?? ''}
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm">
              {RISK_FLAG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-text">
            <span>Reference / Donor</span>
            <input
              type="search"
              name="reference"
              defaultValue={reference ?? ''}
              placeholder="e.g. MP- or TXN"
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm"
            />
          </label>

          <label className="flex min-h-11 items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              name="mine"
              value="1"
              defaultChecked={mine}
              className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
            />
            <span>My claimed cases</span>
          </label>

          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:bg-primary-dark">
            Filter
          </button>

          {canExport ? (
            <div className="ml-auto">
              <a
                href={`/finance/ledger.csv?month=${encodeURIComponent(currentMonth)}`}
                download
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-text hover:bg-card">
                <span>Export Ledger CSV</span>
              </a>
            </div>
          ) : null}
        </form>
      </div>

      {/* Contributions Table */}
      <RecordTable
        caption="Party fund bank transfer contributions"
        rows={items}
        locale="en"
        rowKey={(row) => row.id}
        href={(row) => `/finance/${row.id}`}
        linkText={(row) => row.contributionRef}
        empty="No contribution records match the selected filters."
        columns={[
          {
            header: 'Donor Member',
            cell: (row) => (
              <span className="font-mono text-xs">{row.donorMemberCode ?? '—'}</span>
            ),
          },
          {
            header: 'Amount (LKR)',
            cell: (row) => (
              <span className="font-semibold text-text">
                {(row.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            ),
          },
          {
            header: 'Transfer Date',
            cell: (row) => <span>{row.transferDate}</span>,
          },
          {
            header: 'Receipt Code',
            cell: (row) => (
              <span className="font-mono text-xs font-semibold text-success">
                {row.receiptCode ?? '—'}
              </span>
            ),
          },
          {
            header: 'Status',
            cell: (row) => <StateTag state={row.status.toLowerCase()} locale="en" />,
          },
          {
            header: 'Risk Flags',
            cell: (row) =>
              row.riskFlags && row.riskFlags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {row.riskFlags.map((flag) => (
                    <span
                      key={flag}
                      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${getRiskBadgeClass(
                        flag,
                      )}`}>
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted">—</span>
              ),
          },
          {
            header: 'Claimed By',
            cell: (row) => (
              <span className="text-xs text-muted">
                {row.claimedByName ?? (row.claimedBy ? 'Staff' : 'Unclaimed')}
              </span>
            ),
          },
        ]}
      />

      <ConsolePagination
        pathname="/finance"
        page={page}
        hasMore={hasMore}
        filters={{
          status,
          month,
          risk_flag: riskFlag,
          reference,
          mine: mine ? '1' : undefined,
        }}
      />
    </div>
  );
}

function getRiskBadgeClass(flag: string): string {
  switch (flag) {
    case 'duplicate_bank_reference':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
    case 'enhanced_review_threshold':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
    case 'third_party_payment':
      return 'bg-surface text-text';
    default:
      return 'bg-surface text-muted';
  }
}
