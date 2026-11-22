import { ApiError, type ManagedDisasterAlert } from '@my-people/api-client';
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
import { DisasterNav } from '@/features/disaster/DisasterNav';
import { ALERT_STATE_LABELS, HAZARD_LABELS, SEVERITY_LABELS, SEVERITY_TONES } from '@/features/disaster/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Relaying alerts needs the disaster relay permission (disaster.relay, PRM-53).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * D26: the official alerts relayed in the viewer's areas. Current alerts that nobody has checked against
 * their source for 6 hours are flagged first (FR-DIS-008); past alerts are kept as history.
 */
export default function DisasterPage(props: PageProps<'/disaster'>) {
  return (
    <>
      <PageHeader ta="அனர்த்த எச்சரிக்கைகளும் நிவாரணமும்" en="Disaster alerts and relief logistics">
        <ButtonLink href="/disaster/alerts/new">Relay an official alert</ButtonLink>
      </PageHeader>
      <DisasterNav current="/disaster" />
      <p className="max-w-3xl text-sm text-muted">
        The app relays official warnings only and never dispatches help (OS-14). Every alert names its official source, links to the
        source’s own page and keeps the source’s issue and end times; members in the targeted areas see it with the emergency numbers.
      </p>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <AlertList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function AlertList({ searchParams }: { searchParams: PageProps<'/disaster'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const history = one(query.view) === 'history';
  if (!staff.permissions.has('disaster.relay')) {
    return (
      <p className="rounded-2xl border border-line bg-card shadow-card p-6 text-sm text-muted">
        Your roles do not include relaying alerts. Relief officers record stock and distributions on the{' '}
        <Link href="/disaster/relief" className={`font-semibold text-primary underline ${FOCUS_RING}`}>
          relief page
        </Link>
        .
      </p>
    );
  }

  let rows: ManagedDisasterAlert[];
  try {
    rows = await (await staffApi()).listManagedAlerts(!history);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Disaster alerts" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The alerts are not available." />;
  }
  const areaNames = await loadAreaNames(rows.flatMap((row) => row.targetKeys));
  const stale = rows.filter((row) => row.stale);

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/disaster"
          aria-current={!history ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center rounded-lg border px-3 font-semibold ${FOCUS_RING} ${!history ? 'border-primary text-primary' : 'border-line text-text'}`}>
          Current
        </Link>
        <Link
          href="/disaster?view=history"
          aria-current={history ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center rounded-lg border px-3 font-semibold ${FOCUS_RING} ${history ? 'border-primary text-primary' : 'border-line text-text'}`}>
          History
        </Link>
      </div>
      {!history && stale.length > 0 ? (
        <p role="alert" className="rounded-xl border border-warning/50 bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
          ! {stale.length} current {stale.length === 1 ? 'alert has' : 'alerts have'} not been checked against the official source for
          6 hours. Open each, check the source, then update or withdraw it.
        </p>
      ) : null}
      <RecordTable
        caption={history ? 'Past alerts' : 'Current alerts'}
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Reference"
        href={(row) => `/disaster/alerts/${row.id}`}
        linkText={(row) => row.alertRef}
        empty={history ? 'No past alerts in your areas.' : 'No current alerts in your areas.'}
        columns={[
          {
            header: 'Severity',
            cell: (row) => (
              <span className="flex flex-col gap-1">
                <BilingualTag label={SEVERITY_LABELS[row.severity]} tone={SEVERITY_TONES[row.severity]} />
                {row.stale ? <BilingualTag label={{ ta: '6 மணி நேரமாகச் சரிபார்க்கப்படவில்லை', en: '! Not checked for 6 hours' }} tone="waiting" /> : null}
                {history ? <BilingualTag label={ALERT_STATE_LABELS[row.state]} /> : null}
              </span>
            ),
          },
          {
            header: 'Alert',
            cell: (row) => (
              <span className="flex max-w-xs flex-col gap-1">
                <BilingualText ta={row.titleTa} en={row.titleEn} />
                <span className="text-xs text-muted">{HAZARD_LABELS[row.hazard].en}</span>
              </span>
            ),
          },
          {
            header: 'Areas',
            cell: (row) => <span className="text-xs text-muted">{row.targetKeys.map((key) => areaText(key, areaNames, 'en')).join(' · ')}</span>,
          },
          {
            header: 'Source and times',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span className="text-text">{row.sourceNameEn}</span>
                <span>issued {formatDateTime(row.sourceIssuedAt)}</span>
                <span>ends {formatDateTime(row.sourceEndsAt)}</span>
                <span>checked {formatDateTime(row.refreshedAt)}</span>
              </span>
            ),
          },
          {
            header: 'Reach',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>{row.recipients} members told</span>
                <span>relayed {row.relayMinutes} min after issue</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
