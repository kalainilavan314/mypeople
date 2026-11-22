import type { AssistantSummary, KnowledgeSourceSummary } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, FOCUS_RING, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { KINDS, KIND_LABELS, KNOWLEDGE_REFUSED, REVIEW_OVERDUE_LABEL, STATES, STATE_LABELS, STATE_TONES } from '@/features/assistant/forms';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS_RING}`;
const LINK = `inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary ${FOCUS_RING}`;
const REFUSED = KNOWLEDGE_REFUSED;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D20: the approved sources the Tamil AI assistant answers from, and the Knowledge Editor's queues. */
export default function AssistantKnowledgePage(props: PageProps<'/assistant'>) {
  return (
    <>
      <PageHeader ta="AI உதவியாளர் அறிவுத் தளம்" en="Assistant knowledge base">
        <div className="flex flex-wrap gap-2">
          <Link href="/assistant/errors" className={LINK}>
            Error reports
          </Link>
          <Link href="/assistant/handovers" className={LINK}>
            Requests for a person
          </Link>
          <Link href="/assistant/try" className={LINK}>
            Try a question
          </Link>
          <ButtonLink href="/assistant/new">New source</ButtonLink>
        </div>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={2} />}>
        <SummaryCounts />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <SourceList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SummaryCounts() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let summary: AssistantSummary;
  try {
    summary = await (await staffApi()).getAssistantSummary();
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The knowledge base is not available." />;
  }
  const tiles: { ta: string; en: string; value: number; href?: string; alert?: boolean }[] = [
    { ta: 'அங்கீகரிக்கப்பட்ட மூலங்கள்', en: 'Approved sources in use', value: summary.approvedSources, href: '/assistant?state=approved' },
    { ta: 'அங்கீகாரத்துக்காகக் காத்திருக்கும் வரைவுகள்', en: 'Drafts waiting for a second editor', value: summary.draftSources, href: '/assistant?state=draft' },
    { ta: 'மீளாய்வுத் திகதி கடந்தவை', en: 'Review overdue (not used)', value: summary.reviewOverdue, alert: summary.reviewOverdue > 0 },
    { ta: '30 நாட்களுக்குள் மீளாய்வு', en: 'Review due within 30 days', value: summary.reviewDueSoon },
    { ta: 'திறந்த பிழை முறைப்பாடுகள்', en: 'Open error reports', value: summary.openErrorReports, href: '/assistant/errors', alert: summary.openErrorReports > 0 },
    { ta: 'ஒருவருடன் பேசக் கோரிக்கைகள்', en: 'Open requests for a person', value: summary.openHandovers, href: '/assistant/handovers', alert: summary.openHandovers > 0 },
    { ta: 'பயனுள்ளது (30 நாட்கள்)', en: 'Rated helpful (30 days)', value: summary.helpful30Days },
    { ta: 'பயனில்லை (30 நாட்கள்)', en: 'Rated not helpful (30 days)', value: summary.notHelpful30Days },
  ];
  return (
    <ul aria-label="Knowledge base summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <li key={tile.en} className={`flex flex-col gap-1 rounded-xl border bg-card p-4 ${tile.alert ? 'border-warning' : 'border-line'}`}>
          <span className="text-2xl font-semibold tabular-nums text-text">{tile.value}</span>
          {tile.href ? (
            <Link href={tile.href} className={`w-fit text-sm text-primary underline ${FOCUS_RING}`}>
              <BilingualText ta={tile.ta} en={tile.en} />
            </Link>
          ) : (
            <BilingualText ta={tile.ta} en={tile.en} className="text-sm" />
          )}
        </li>
      ))}
    </ul>
  );
}

async function SourceList({ searchParams }: { searchParams: PageProps<'/assistant'>['searchParams'] }) {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const state = STATES.find((item) => item === one(query.state));
  const kind = KINDS.find((item) => item === one(query.kind));

  let rows: KnowledgeSourceSummary[];
  try {
    rows = await (await staffApi()).listKnowledgeSources({ state, kind });
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The source list is not available." />;
  }

  return (
    <Section
      id="sources"
      ta="அங்கீகரிக்கப்பட்ட மூலங்கள்"
      en="Approved sources"
      intro="The assistant answers only from approved sources: policies, published manifesto material, app help and public-service guides. Each version needs a second Knowledge Editor's approval and a review date; past it, the source is not used until reviewed again.">
      <Feedback done={one(query.done)} />
      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card shadow-card p-4">
        <label htmlFor="source-state" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          State
          <select id="source-state" name="state" defaultValue={state ?? ''} className={CONTROL}>
            <option value="">Drafts, approved and retired</option>
            {STATES.map((code) => (
              <option key={code} value={code}>
                {STATE_LABELS[code].ta} · {STATE_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="source-kind" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          Kind
          <select id="source-kind" name="kind" defaultValue={kind ?? ''} className={CONTROL}>
            <option value="">All kinds</option>
            {KINDS.map((code) => (
              <option key={code} value={code}>
                {KIND_LABELS[code].ta} · {KIND_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
          Apply filters
        </button>
        {state || kind ? (
          <Link href="/assistant" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
            Clear filters
          </Link>
        ) : null}
      </form>
      <RecordTable
        caption="Knowledge sources"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Version"
        href={(row) => `/assistant/${row.id}`}
        linkText={(row) => `v${row.version}`}
        empty={state || kind ? 'No sources match these filters.' : 'No sources yet. Add the first approved source so the assistant can answer.'}
        columns={[
          {
            header: 'State',
            cell: (row) => (
              <span className="flex flex-col gap-1">
                <BilingualTag label={STATE_LABELS[row.state]} tone={STATE_TONES[row.state]} />
                {row.reviewOverdue ? <BilingualTag label={REVIEW_OVERDUE_LABEL} tone="refused" /> : null}
              </span>
            ),
          },
          { header: 'Source', cell: (row) => <BilingualText ta={row.titleTa} en={row.titleEn} className="max-w-xs" /> },
          { header: 'Kind', cell: (row) => <BilingualText ta={KIND_LABELS[row.kind].ta} en={KIND_LABELS[row.kind].en} /> },
          { header: 'Issued by', cell: (row) => <span className="text-xs text-text">{row.publisher}</span> },
          {
            header: 'Review',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>review by {formatDate(row.reviewDue)}</span>
                <span>{row.approvedAt ? `approved ${formatDate(row.approvedAt)}` : 'not approved yet'}</span>
                <span>{row.passages} passages searched</span>
              </span>
            ),
          },
        ]}
      />
    </Section>
  );
}
