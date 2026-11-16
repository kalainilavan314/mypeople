import { ApiError, type ProposalNeeds, type ProposalSummary } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { RecordTable } from '@/components/RecordTable';
import { needsTable } from '@/features/development/needs';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PROPOSAL_STAGES,
  STAGE_LABELS,
  STAGE_TONES,
  isCategory,
  isProposalStage,
} from '@/features/development/stages';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { countText, countTextTa } from '@/lib/formState';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS}`;
const REFUSED = 'Development proposals need content moderation, development review or planning approval.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D15: development proposals in the viewer's areas by stage, category and search, and the regional needs. */
export default function DevelopmentPage(props: PageProps<'/development'>) {
  return (
    <>
      <PageHeader ta="அபிவிருத்தி முன்மொழிவுகள்" en="Development proposals" />
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p>Proposals move by the decision of the tier that holds each authority, never by how popular they are.</p>
        <p>AI topic and duplicate suggestions arrive after the AI provider decision (OD-42).</p>
      </div>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <ProposalQueue searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={4} />}>
        <RegionalNeeds />
      </Suspense>
    </>
  );
}

async function ProposalQueue({ searchParams }: { searchParams: PageProps<'/development'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const requestedStage = one(query.stage);
  const requestedCategory = one(query.category);
  const stage = isProposalStage(requestedStage) ? requestedStage : undefined;
  const category = isCategory(requestedCategory) ? requestedCategory : undefined;
  const search = (one(query.q) ?? '').trim().slice(0, 80);

  let rows: ProposalSummary[];
  try {
    rows = await (await staffApi()).listManagedProposals({ stage: stage ? [stage] : undefined, category, q: search || undefined });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Development proposals are not switched on yet.</p>;
    }
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The proposal list is not available." />;
  }
  const areaNames = await loadAreaNames(rows.map((row) => row.areaKey));
  const filtered = Boolean(stage || category || search);

  return (
    <div className="flex flex-col gap-4">
      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        <label htmlFor="proposal-search" className="flex min-w-56 flex-col gap-1 text-sm font-semibold text-text">
          Reference or title
          <input id="proposal-search" name="q" type="search" maxLength={80} defaultValue={search} className={CONTROL} />
        </label>
        <label htmlFor="proposal-stage" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          Stage
          <select id="proposal-stage" name="stage" defaultValue={stage ?? ''} className={CONTROL}>
            <option value="">All stages</option>
            {PROPOSAL_STAGES.map((code) => (
              <option key={code} value={code}>
                {STAGE_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="proposal-category" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          Category
          <select id="proposal-category" name="category" defaultValue={category ?? ''} className={CONTROL}>
            <option value="">All categories</option>
            {CATEGORIES.map((code) => (
              <option key={code} value={code}>
                {CATEGORY_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS}`}>
          Apply filters
        </button>
        {filtered ? (
          <Link href="/development" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
            Clear filters
          </Link>
        ) : null}
      </form>

      <p className="text-xs text-muted">
        {rows.length} {rows.length === 1 ? 'proposal matches' : 'proposals match'}, latest activity first (at most 200).
      </p>

      <RecordTable
        caption="Development proposals"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Reference"
        href={(row) => `/development/${row.id}`}
        linkText={(row) => row.proposalRef}
        empty={filtered ? 'No proposals match these filters.' : 'No development proposals in your areas yet.'}
        columns={[
          { header: 'Stage', cell: (row) => <BilingualTag label={STAGE_LABELS[row.stage]} tone={STAGE_TONES[row.stage]} /> },
          { header: 'Title', cell: (row) => <span className="line-clamp-2 max-w-xs text-text">{row.title}</span> },
          { header: 'Category', cell: (row) => <BilingualText ta={CATEGORY_LABELS[row.category].ta} en={CATEGORY_LABELS[row.category].en} /> },
          { header: 'Area', cell: (row) => <span className="text-text">{areaText(row.areaKey, areaNames, 'en')}</span> },
          { header: 'Updated', cell: (row) => <span className="text-xs tabular-nums text-muted">{formatDateTime(row.updatedAt)}</span> },
        ]}
      />
    </div>
  );
}

/** FR-DEV-008: published proposals by area and category; any group under 10 is shown as "fewer than 10". */
async function RegionalNeeds() {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let needs: ProposalNeeds;
  try {
    needs = await (await staffApi()).getProposalNeeds();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return null;
    return (
      <NeedsSection>
        <LoadFailure
          error={error}
          locale={locale}
          refused="The regional needs table needs development review or planning approval."
          notFound="The regional needs table is not available."
        />
      </NeedsSection>
    );
  }
  const table = needsTable(needs.cells);
  const areaNames = await loadAreaNames(table.areas);
  return (
    <NeedsSection>
      {table.areas.length === 0 ? (
        <p className="text-sm text-muted">No published proposals in your areas yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Published proposals by area and category</caption>
            <thead className="border-b border-line text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-text">
                  Area
                </th>
                {table.categories.map((code) => (
                  <th key={code} scope="col" className="px-3 py-2 font-semibold text-text">
                    <BilingualText ta={CATEGORY_LABELS[code].ta} en={CATEGORY_LABELS[code].en} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.areas.map((area) => (
                <tr key={area}>
                  <th scope="row" className="px-3 py-2 font-semibold text-text">
                    {areaText(area, areaNames, 'en')}
                  </th>
                  {table.categories.map((code) => {
                    const cell = table.count(area, code);
                    return (
                      <td key={code} className="px-3 py-2 tabular-nums">
                        {cell === undefined ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className={cell === null ? 'flex flex-col text-xs text-muted' : 'text-text'}>
                            {cell === null ? (
                              <>
                                <span lang="ta">{countTextTa(cell)}</span>
                                <span lang="en">{countText(cell)}</span>
                              </>
                            ) : (
                              countText(cell)
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </NeedsSection>
  );
}

function NeedsSection({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="needs-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
      <h2 id="needs-heading" className="flex flex-col text-lg font-bold text-text">
        <span lang="ta">பிராந்தியத் தேவைகள்</span>
        <span lang="en" className="text-sm font-semibold text-muted">
          Regional needs
        </span>
      </h2>
      <p className="text-sm text-muted">
        Published proposals by district (and DS division where the numbers allow) and category. Any group under 10 shows as “fewer than
        10” so a small group cannot be singled out. A dash means no proposals.
      </p>
      {children}
    </section>
  );
}
