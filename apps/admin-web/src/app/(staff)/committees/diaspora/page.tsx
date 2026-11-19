import { ApiError, type DiasporaEvent, type DiasporaSummary } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure } from '@/components/PageProblem';
import { BackLink, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { setEventListed } from '@/features/committees/actions';
import { COMMITTEE_TARGETS } from '@/features/committees/forms';
import { COUNTRY_NAMES, PROPOSAL_STAGE_LABELS, TOPIC_LABELS, countText } from '@/features/committees/diaspora';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Diaspora participation for staff (FR-DSP-002, 004, 006): which events are listed for supporters
 * abroad, and supporters in numbers only (small numbers hidden). There is no list of supporters
 * and no payment setting: contributions from abroad stay off until OD-40 is decided.
 */
export default function DiasporaPage(props: PageProps<'/committees/diaspora'>) {
  return (
    <>
      <BackLink href="/committees">Back to committees and wings</BackLink>
      <PageHeader ta="புலம்பெயர் பங்கேற்பு" en="Diaspora participation" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <DiasporaAdmin searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function DiasporaAdmin({ searchParams }: { searchParams: PageProps<'/committees/diaspora'>['searchParams'] }) {
  await connection();
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const client = await staffApi();
  const marksEvents = staff.permissions.has('events.manage');
  const readsSummary = staff.assignments.some((a) => a.area.level === 'platform' && a.permissions.includes('analytics.view'));

  let events: DiasporaEvent[] = [];
  let summary: DiasporaSummary | null = null;
  try {
    [events, summary] = await Promise.all([
      marksEvents ? client.listDiasporaManagedEvents() : Promise.resolve([]),
      readsSummary ? client.getDiasporaSummary() : Promise.resolve(null),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Diaspora participation" />;
    return <LoadFailure error={error} locale={locale} refused="This needs events.manage, or analytics.view over the whole platform." notFound="Not available." />;
  }
  const areaNames = await loadAreaNames(events.map((event) => event.areaKey));

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="rounded-xl border border-warning bg-warning-bg p-4 text-sm text-warning">
        <span lang="ta" className="block">
          சட்ட, வங்கி, நாணய, செயலிக் கடை அனுமதிகள் பதிவுசெய்யப்படும் வரை வெளிநாட்டுப் பங்களிப்புகள் நிறுத்தப்பட்டுள்ளன (OD-40).
        </span>
        <span lang="en" className="block">
          Contributions from abroad stay switched off until legal, banking, currency and app-store approvals are recorded (OD-40,
          OS-16). Registration as a supporter abroad gives no right to contribute.
        </span>
      </p>

      {!marksEvents && !readsSummary ? (
        <p className="text-sm text-muted">Listing events needs events.manage; the numbers need analytics.view over the whole platform.</p>
      ) : null}

      {marksEvents ? (
        <Section
          id="international-events"
          ta="வெளிநாட்டிலிருந்து பங்கேற்கக்கூடிய நிகழ்வுகள்"
          en={`Events for supporters abroad (${events.filter((e) => e.international).length} listed)`}
          intro="Listed events appear in the app with the time in Sri Lanka and in each supporter's own time zone. Supporters who asked are notified.">
          {events.length === 0 ? (
            <p className="text-sm text-muted">No published, upcoming events in your areas.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {events.map((event) => (
                <li key={event.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{event.eventRef}</span>
                    {event.international ? (
                      <BilingualTag label={{ ta: 'பட்டியலிடப்பட்டது', en: 'Listed for abroad' }} tone="done" />
                    ) : null}
                    <span className="text-xs text-muted">
                      {formatDateTime(event.startsAt)} · {areaText(event.areaKey, areaNames, 'en')}
                    </span>
                  </p>
                  <p>
                    <span lang="ta" className="block">{event.titleTa}</span>
                    <span lang="en" className="block text-muted">{event.titleEn}</span>
                  </p>
                  <SimpleForm
                    id={`listed-${event.id.slice(0, 8)}`}
                    action={setEventListed}
                    hidden={{ eventId: event.id, international: event.international ? 'no' : 'yes' }}
                    fields={[]}
                    submits={[{ label: event.international ? 'Take off the list' : 'List for supporters abroad', tone: event.international ? 'secondary' : 'primary' }]}
                    targets={COMMITTEE_TARGETS}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      {summary ? (
        <Section
          id="supporters"
          ta="வெளிநாட்டு ஆதரவாளர்கள் (எண்ணிக்கை மட்டும்)"
          en={`Supporters abroad: ${summary.total}`}
          intro="Counts only. Any count under 5 is shown as “fewer than 5”, so a small group cannot be singled out.">
          <div className="grid gap-4 sm:grid-cols-3">
            <CountList title="By country" rows={summary.byCountry.map((row) => [COUNTRY_NAMES[row.key] ?? row.key, row.count])} />
            <CountList title="Asked to hear about" rows={summary.byTopic.map((row) => [TOPIC_LABELS[row.key] ?? row.key, row.count])} />
            <CountList
              title="Development proposals from abroad, by stage"
              rows={summary.proposalsByStage.map((row) => [PROPOSAL_STAGE_LABELS[row.key] ?? row.key, row.count])}
            />
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function CountList({ title, rows }: { title: string; rows: (readonly [string, number | null])[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
      <h3 className="font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-muted">None yet.</p>
      ) : (
        <dl className="flex flex-col gap-1">
          {rows.map(([label, count]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt>{label}</dt>
              <dd className="tabular-nums">{countText(count)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
