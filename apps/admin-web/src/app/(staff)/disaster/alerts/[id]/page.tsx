import { ApiError, type ManagedDisasterAlert } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { refreshAlert, withdrawAlert } from '@/features/disaster/actions';
import { alertTextFields } from '@/features/disaster/alertFields';
import { ALERT_STATE_LABELS, HAZARD_LABELS, SAFETY_TARGETS, SEVERITY_LABELS, SEVERITY_TONES } from '@/features/disaster/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime, toSriLankaDateTimeInput } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Relaying alerts needs the disaster relay permission (disaster.relay, PRM-53).';
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** One relayed alert with every check against its source (FR-DIS-008), and the forms to check it again or withdraw it. */
export default function AlertPage(props: PageProps<'/disaster/alerts/[id]'>) {
  return (
    <>
      <BackLink href="/disaster">All alerts</BackLink>
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <AlertFile {...props} />
      </Suspense>
    </>
  );
}

async function AlertFile({ params, searchParams }: PageProps<'/disaster/alerts/[id]'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  let alert: ManagedDisasterAlert;
  try {
    alert = await (await staffApi()).getManagedAlert(id);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Disaster alerts" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="This alert does not exist or is outside your areas." />;
  }
  const areaNames = await loadAreaNames(alert.targetKeys);
  const current = alert.state === 'current';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader ta={alert.titleTa} en={alert.titleEn} />
      <Feedback done={one(query.done)} />
      {alert.stale ? (
        <p role="alert" className="rounded-xl border border-warning/50 bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
          ! Nobody has checked this alert against its source for 6 hours. Open the source, then record the check below or withdraw it.
        </p>
      ) : null}
      <Section id="alert" ta="எச்சரிக்கை" en={alert.alertRef}>
        <div className="flex flex-wrap gap-2">
          <BilingualTag label={SEVERITY_LABELS[alert.severity]} tone={SEVERITY_TONES[alert.severity]} />
          <BilingualTag label={HAZARD_LABELS[alert.hazard]} />
          <BilingualTag label={ALERT_STATE_LABELS[alert.state]} tone={current ? 'waiting' : 'neutral'} />
        </div>
        <Both ta={alert.bodyTa} en={alert.bodyEn} />
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <Detail label="Official source">
            <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
              {alert.sourceNameEn}
            </a>
          </Detail>
          <Detail label="Issued by the source">{formatDateTime(alert.sourceIssuedAt)}</Detail>
          <Detail label="Ends">{formatDateTime(alert.sourceEndsAt)}</Detail>
          <Detail label="Last checked with the source">{formatDateTime(alert.refreshedAt)}</Detail>
          <Detail label="Relayed">{`${formatDateTime(alert.relayedAt)} (${alert.relayMinutes} min after issue)`}</Detail>
          <Detail label="Members told">{String(alert.recipients)}</Detail>
          <Detail label="Targeted areas">{alert.targetKeys.map((key) => areaText(key, areaNames, 'en')).join(' · ')}</Detail>
          {alert.withdrawnReason ? <Detail label="Withdrawn because">{alert.withdrawnReason}</Detail> : null}
        </dl>
      </Section>

      <Section id="revisions" ta="மூலத்துடனான சரிபார்ப்புகள்" en={`Relay and checks (${alert.revisions.length})`} intro="Kept as they were; nothing is overwritten.">
        <ol className="flex flex-col divide-y divide-line text-sm">
          {alert.revisions.map((revision, index) => (
            <li key={index} className="flex flex-col gap-1 py-2">
              <span className="font-semibold text-text">
                {revision.kind === 'relayed' ? 'Relayed' : revision.kind === 'refreshed' ? 'Checked with the source' : 'Withdrawn'} ·{' '}
                {formatDateTime(revision.changedAt)}
              </span>
              <span className="text-xs text-muted">
                {SEVERITY_LABELS[revision.severity].en} · issued {formatDateTime(revision.sourceIssuedAt)} · ends {formatDateTime(revision.sourceEndsAt)}
              </span>
              {revision.note ? <span className="text-xs text-muted">{revision.note}</span> : null}
            </li>
          ))}
        </ol>
      </Section>

      {current ? (
        <>
          <Section
            id="refresh"
            ta="மூலத்துடன் மீண்டும் சரிபார்த்தல்"
            en="Record a check against the source"
            intro="Open the source, then copy its latest link, times, severity and text. A higher severity tells the members again.">
            <SimpleForm
              id="refresh-alert"
              action={refreshAlert}
              hidden={{ alertId: alert.id }}
              fields={[
                ...alertTextFields({
                  sourceUrl: alert.sourceUrl,
                  sourceIssuedAt: toSriLankaDateTimeInput(alert.sourceIssuedAt),
                  sourceEndsAt: toSriLankaDateTimeInput(alert.sourceEndsAt),
                  severity: alert.severity,
                  titleTa: alert.titleTa,
                  titleEn: alert.titleEn,
                  bodyTa: alert.bodyTa,
                  bodyEn: alert.bodyEn,
                }),
                { name: 'note', label: 'Note on the check', maxLength: 500, hint: 'For example: no change on the DMC page at 14:00.', wide: true },
              ]}
              submits={[{ label: 'Record the check' }]}
              targets={SAFETY_TARGETS}
            />
          </Section>
          <Section id="withdraw" ta="மீளப்பெறுதல்" en="Withdraw the alert" intro="When the source cancels the warning, or it was relayed by mistake. It moves to history with the reason.">
            <SimpleForm
              id="withdraw-alert"
              action={withdrawAlert}
              hidden={{ alertId: alert.id }}
              fields={[{ name: 'reason', label: 'Reason, shown to members', kind: 'textarea', required: true, minLength: 5, maxLength: 500 }]}
              submits={[{ label: 'Withdraw the alert', tone: 'danger' }]}
              targets={SAFETY_TARGETS}
            />
          </Section>
        </>
      ) : null}
    </div>
  );
}
