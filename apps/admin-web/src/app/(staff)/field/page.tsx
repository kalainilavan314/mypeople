import { ApiError, type FieldVisit, type FieldVisitCount } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { setFollowUp } from '@/features/field/actions';
import { CONCERN_LABELS, countsTable, visitPlaceKey } from '@/features/field/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Field visits need the field collection permission (field.collect).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * D24: community-service visits in the supervisor's areas, their follow-ups, and counts by place
 * and concern. The place is a GN or DS division, or none (S05). Nothing political is recorded or
 * shown; a visit whose consent was declined shows only its place and time.
 */
export default function FieldPage(props: PageProps<'/field'>) {
  return (
    <>
      <PageHeader ta="களப் பார்வைகள்" en="Field visits" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Visits searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={3} />}>
        <Counts />
      </Suspense>
    </>
  );
}

async function Visits({ searchParams }: { searchParams: PageProps<'/field'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const openOnly = one(query.open) === '1';
  let visits: FieldVisit[];
  try {
    visits = await (await staffApi()).listSupervisedFieldVisits(openOnly);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Field visits" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The visit list is not available." />;
  }
  const areaNames = await loadAreaNames(visits.map((visit) => visitPlaceKey(visit).key));

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Community-service notes only: there is no field for voting intention or political preference. Visits are deleted after 12
        months, leaving monthly counts.
      </p>
      <nav aria-label="Filter visits" className="flex flex-wrap gap-2">
        {[
          { href: '/field', label: 'All visits', ta: 'அனைத்துப் பார்வைகளும்', active: !openOnly },
          { href: '/field?open=1', label: 'Open follow-ups', ta: 'நிலுவையிலுள்ள தொடர் நடவடிக்கைகள்', active: openOnly },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`flex min-h-11 flex-col justify-center rounded-lg border px-3 py-1.5 text-sm ${FOCUS_RING} ${item.active ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-card text-text hover:bg-surface'}`}>
            <span lang="ta" className="font-semibold">{item.ta}</span>
            <span lang="en" className="text-xs">{item.label}</span>
          </Link>
        ))}
      </nav>
      {visits.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">{openOnly ? 'No open follow-ups.' : 'No visits recorded in your areas.'}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visits.map((visit) => (
            <li key={visit.id} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-muted">{visit.visitRef}</span>
                <span className="font-semibold text-text">
                  {visitPlaceKey(visit).given ? areaText(visitPlaceKey(visit).key, areaNames, 'en') : `No place given (${areaText(visit.areaKey, areaNames, 'en')})`}
                </span>
                <span className="text-xs tabular-nums text-muted">{formatDateTime(visit.visitedAt)}</span>
                {visit.consent === 'declined' ? <BilingualTag label={{ ta: 'ஒப்புதல் மறுக்கப்பட்டது', en: 'Consent declined' }} /> : null}
              </p>
              {visit.consent === 'declined' ? (
                <p className="text-xs text-muted">The person declined, so only the place and time are kept.</p>
              ) : (
                <>
                  <p className="text-xs text-muted">Recorded by {visit.coordinatorName}</p>
                  {visit.concerns.length > 0 ? (
                    <ul className="flex flex-wrap gap-1" aria-label="Concerns">
                      {visit.concerns.map((concern) => (
                        <li key={concern}>
                          <BilingualTag label={CONCERN_LABELS[concern] ?? { ta: concern, en: concern }} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {visit.placeText ? <p className="text-text">Place: {visit.placeText}</p> : null}
                  {visit.notes ? <p className="whitespace-pre-wrap text-text">{visit.notes}</p> : null}
                  {visit.caseNumber ? (
                    <p className="text-xs text-muted">
                      Community case <span className="font-mono">{visit.caseNumber}</span>
                    </p>
                  ) : null}
                  {visit.followUp ? (
                    <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
                      <p className="text-xs font-semibold text-muted">
                        Follow-up {visit.followUpDoneAt ? `done ${formatDateTime(visit.followUpDoneAt)}` : 'open'}
                      </p>
                      <p className="whitespace-pre-wrap text-text">{visit.followUp}</p>
                      <SimpleForm
                        id={`follow-${visit.id.slice(0, 8)}`}
                        action={setFollowUp}
                        hidden={{ visitId: visit.id, done: visit.followUpDoneAt ? '0' : '1', open: openOnly ? '1' : '0' }}
                        fields={[]}
                        submits={[{ label: visit.followUpDoneAt ? 'Reopen the follow-up' : 'Mark follow-up done', tone: visit.followUpDoneAt ? 'secondary' : 'primary' }]}
                        targets={{}}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Counts() {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let counts: FieldVisitCount[];
  try {
    counts = await (await staffApi()).getFieldVisitCounts();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return null;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The visit counts are not available." />;
  }
  const table = countsTable(counts);
  const areaNames = await loadAreaNames(table.places);
  return (
    <Section
      id="counts"
      ta="இடவாரியான எண்ணிக்கைகள்"
      en="Visits by place and concern"
      intro="A place is a GN or DS division. Visits recorded without a place are counted under the coordinator's area.">
      {table.places.length === 0 ? (
        <p className="text-sm text-muted">Nothing to count yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Visits by place and concern</caption>
            <thead className="border-b border-line text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-text">
                  <span lang="ta" className="block">இடம்</span>
                  <span lang="en" className="block font-normal text-muted">Place</span>
                </th>
                {table.concerns.map((concern) => (
                  <th key={concern} scope="col" className="px-3 py-2 font-semibold text-text">
                    <span lang="ta" className="block">{CONCERN_LABELS[concern]?.ta ?? concern}</span>
                    <span lang="en" className="block font-normal text-muted">{CONCERN_LABELS[concern]?.en ?? concern}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.places.map((place) => (
                <tr key={place}>
                  <th scope="row" className="px-3 py-2 font-semibold text-text">{areaText(place, areaNames, 'en')}</th>
                  {table.concerns.map((concern) => (
                    <td key={concern} className="px-3 py-2 tabular-nums text-text">{table.count(place, concern)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
