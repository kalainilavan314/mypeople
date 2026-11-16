import { ApiError, type ManagedVolunteerOpportunity, type VolunteerOpportunityState } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { RecordTable } from '@/components/RecordTable';
import { OPPORTUNITY_STATE_LABELS } from '@/features/volunteering/forms';
import { VolunteeringNav } from '@/features/volunteering/VolunteeringNav';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const REFUSED = 'Volunteering opportunities need the volunteer management permission (volunteers.manage).';
const STATES: readonly VolunteerOpportunityState[] = ['open', 'draft', 'closed', 'cancelled'];
const TONES = { draft: 'neutral', open: 'waiting', closed: 'done', cancelled: 'refused' } as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** S10 on the web: the opportunities in the coordinator's areas, by state, with places filled and waiting. */
export default function VolunteeringPage(props: PageProps<'/volunteering'>) {
  return (
    <>
      <PageHeader ta="தன்னார்வ வாய்ப்புகள்" en="Volunteering opportunities">
        <Link href="/volunteering/new" className={`inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS}`}>
          New opportunity
        </Link>
      </PageHeader>
      <VolunteeringNav current="/volunteering" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <OpportunityList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function OpportunityList({ searchParams }: { searchParams: PageProps<'/volunteering'>['searchParams'] }) {
  // Read when the request comes in: API_URL may be set only on the running server.
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const requested = one(query.state);
  const filter = STATES.find((state) => state === requested);

  let all: ManagedVolunteerOpportunity[];
  try {
    all = await (await staffApi()).listManagedVolunteerOpportunities();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Volunteering is not switched on yet.</p>;
    }
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The opportunity list is not available." />;
  }

  const rows = filter ? all.filter((item) => item.state === filter) : all;
  const areaNames = await loadAreaNames(rows.map((item) => item.areaKey));
  const count = (state: VolunteerOpportunityState) => all.filter((item) => item.state === state).length;

  return (
    <div className="flex flex-col gap-6">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Opportunities members in your areas can offer to help with. Drafts are seen only here until opened. The 100 most recent are
        listed, latest start first.
      </p>

      <section aria-labelledby="states-heading" className="flex flex-col gap-2">
        <h2 id="states-heading" className="text-sm font-semibold text-text">
          Opportunities by state
        </h2>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="/volunteering"
              aria-current={!filter ? 'page' : undefined}
              className={`flex min-h-11 flex-col rounded-lg border px-3 py-2 ${FOCUS} ${!filter ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-card text-text hover:bg-surface'}`}>
              <span className="text-lg font-bold tabular-nums">{all.length}</span>
              <span className="text-xs font-semibold">
                <span lang="ta">அனைத்தும்</span> · All
              </span>
            </Link>
          </li>
          {STATES.map((state) => (
            <li key={state}>
              <Link
                href={`/volunteering?state=${state}`}
                aria-current={filter === state ? 'page' : undefined}
                className={`flex min-h-11 flex-col rounded-lg border px-3 py-2 ${FOCUS} ${
                  filter === state ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-card text-text hover:bg-surface'
                }`}>
                <span className="text-lg font-bold tabular-nums">{count(state)}</span>
                <span lang="ta" className="text-xs font-semibold">
                  {OPPORTUNITY_STATE_LABELS[state].ta}
                </span>
                <span className="text-xs text-muted">{OPPORTUNITY_STATE_LABELS[state].en}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <RecordTable
        caption="Volunteering opportunities"
        locale={locale}
        rows={rows}
        rowKey={(item) => item.id}
        refHeader="Reference"
        href={(item) => `/volunteering/${item.id}`}
        linkText={(item) => item.opportunityRef}
        empty={filter ? 'No opportunities in this state.' : 'No volunteering opportunities in your areas yet.'}
        columns={[
          { header: 'State', cell: (item) => <BilingualTag label={OPPORTUNITY_STATE_LABELS[item.state]} tone={TONES[item.state]} /> },
          { header: 'Title', cell: (item) => <BilingualText ta={item.titleTa} en={item.titleEn} className="max-w-xs" /> },
          {
            header: 'When',
            cell: (item) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>{formatDateTime(item.startsAt)}</span>
                <span>to {formatDateTime(item.endsAt)}</span>
              </span>
            ),
          },
          { header: 'Area', cell: (item) => <span className="text-text">{areaText(item.areaKey, areaNames, 'en')}</span> },
          {
            header: 'Places',
            cell: (item) => (
              <span className="flex flex-col text-xs tabular-nums">
                <span className="text-text">
                  {item.confirmed} of {item.places} confirmed
                </span>
                <span className={item.waiting > 0 ? 'font-semibold text-warning' : 'text-muted'}>{item.waiting} waiting</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
