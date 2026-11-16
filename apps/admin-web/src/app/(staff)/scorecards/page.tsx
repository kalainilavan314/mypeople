import { ApiError, type Scorecard } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { NotSwitchedOn } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { SimpleForm } from '@/components/SimpleForm';
import { draftScorecard } from '@/features/scorecards/actions';
import { SCORECARD_TARGETS, STATE_LABELS, lastFinishedQuarter } from '@/features/scorecards/forms';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Scorecards need scorecard publishing or a community case permission.';
const TONES = { draft: 'neutral', shared: 'waiting', published: 'done', superseded: 'neutral' } as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D17: every scorecard version by quarter; a finished quarter can be drafted. */
export default function ScorecardsPage(props: PageProps<'/scorecards'>) {
  return (
    <>
      <PageHeader ta="பொறுப்புக்கூறல் மதிப்பீட்டு அட்டைகள்" en="Accountability scorecards" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Versions searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Versions({ searchParams }: { searchParams: PageProps<'/scorecards'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  let cards: Scorecard[];
  try {
    cards = await (await staffApi()).listScorecards();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Scorecards" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The scorecard list is not available." />;
  }
  const publisher = staff.permissions.has('scorecard.publish');

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Figures per GN, DS division and district from the community cases of a quarter. Each value carries its numerator and
        denominator; an area with fewer than 10 accepted cases shows “Insufficient data”. No person and no case text appears.
      </p>
      {publisher ? (
        <SimpleForm
          id="draft"
          title="Draft a finished quarter"
          intro="The quarter must have ended. Sharing gives the responsible tiers 10 working days to ask for corrections before it can be published."
          action={draftScorecard}
          fields={[{ name: 'period', label: 'Quarter (for example 2026-Q3)', required: true, minLength: 7, maxLength: 7, defaultValue: lastFinishedQuarter(new Date()), mono: true }]}
          submits={[{ label: 'Draft scorecard' }]}
          targets={SCORECARD_TARGETS}
        />
      ) : null}
      <RecordTable
        caption="Scorecard versions"
        locale={locale}
        rows={cards}
        rowKey={(card) => card.id}
        refHeader="Quarter"
        href={(card) => `/scorecards/${card.id}`}
        linkText={(card) => `${card.period} v${card.version}`}
        empty="No scorecards yet."
        columns={[
          { header: 'State', cell: (card) => <BilingualTag label={STATE_LABELS[card.state]} tone={TONES[card.state]} /> },
          { header: 'Areas', cell: (card) => <span className="tabular-nums text-text">{Object.keys(card.figures).length}</span> },
          {
            header: 'Dates',
            cell: (card) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>drafted {formatDateTime(card.createdAt)}</span>
                {card.sharedAt ? <span>shared {formatDateTime(card.sharedAt)}</span> : null}
                {card.publishedAt ? <span>published {formatDateTime(card.publishedAt)}</span> : null}
              </span>
            ),
          },
          { header: 'Service levels', cell: (card) => <span className="text-xs text-muted">{card.slaVersion}</span> },
        ]}
      />
    </div>
  );
}
