import { ApiError, type BloodRequestDetail } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Detail, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { closeRequest } from '@/features/blood-requests/actions';
import {
  BLOOD_TARGETS,
  CONTACT_METHOD_LABELS,
  OUTCOMES,
  OUTCOME_LABELS,
  REQUEST_STATE_LABELS,
  stateKey,
  URGENCY_LABELS,
  URGENCY_TONES,
} from '@/features/blood-requests/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * One of the partner's requests: how many donors were told, accepted and declined, and the contact of each
 * donor who accepted and agreed to share it (FR-BLD-004, 005). Closed with an outcome when no longer needed.
 */
export default function BloodRequestPage(props: PageProps<'/blood-requests/[id]'>) {
  return (
    <>
      <BackLink href="/blood-requests">Blood request desk</BackLink>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <RequestFile {...props} />
      </Suspense>
    </>
  );
}

async function RequestFile({ params, searchParams }: PageProps<'/blood-requests/[id]'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  let request: BloodRequestDetail;
  try {
    request = await (await staffApi()).getBloodRequest(id);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="The blood donor network" />;
    return (
      <LoadFailure
        error={error}
        locale={locale}
        refused="Only an authorised requester of the partner that raised it may open a request."
        notFound="This request does not exist or belongs to another partner."
      />
    );
  }
  const areaNames = await loadAreaNames([request.areaKey]);
  const open = request.state === 'open' || request.state === 'awaiting_approval';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader ta={`இரத்தக் கோரிக்கை ${request.requestRef}`} en={`Blood request ${request.requestRef}`} />
      <Feedback done={one(query.done)} />
      <Section id="request" ta="கோரிக்கை" en={`${request.bloodGroup} · ${request.units} units`}>
        <div className="flex flex-wrap gap-2">
          <BilingualTag label={REQUEST_STATE_LABELS[stateKey(request.state, request.expired)] ?? { ta: request.state, en: request.state }} />
          <BilingualTag label={URGENCY_LABELS[request.urgency]} tone={URGENCY_TONES[request.urgency]} />
        </div>
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <Detail label="Area">{areaText(request.areaKey, areaNames, 'en')}</Detail>
          <Detail label="Needed by">{formatDateTime(request.neededBy)}</Detail>
          <Detail label="Raised">{formatDateTime(request.createdAt)}</Detail>
          <Detail label="Donors told">{String(request.notified)}</Detail>
          <Detail label="Accepted">{String(request.accepted)}</Detail>
          <Detail label="Declined">{String(request.declined)}</Detail>
          {request.overLimit ? <Detail label="Over the hourly limit">Needed Tier 5 approval</Detail> : null}
          {request.decisionReason ? <Detail label="Tier 5 reason">{request.decisionReason}</Detail> : null}
          {request.outcome ? <Detail label="Outcome">{OUTCOME_LABELS[request.outcome].en}</Detail> : null}
        </dl>
      </Section>

      <Section
        id="contacts"
        ta="ஒப்புக்கொண்ட தானம் செய்வோர்"
        en={`Donors who accepted (${request.contacts.length})`}
        intro="Each agreed to share this contact with you for this request only. Your staff decide whether they can give; do not keep or pass on the contact for anything else.">
        {request.contacts.length === 0 ? (
          <p className="text-sm text-muted">No donor has accepted yet. Nobody else’s identity is ever shown.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {request.contacts.map((contact, index) => (
              <li key={`${contact.phone}-${index}`} className="flex flex-col gap-1 py-2">
                <span className="font-semibold text-text">{contact.name}</span>
                <span className="font-mono">{contact.phone}</span>
                <span className="text-xs text-muted">
                  {`Prefers ${contact.methods.map((method) => CONTACT_METHOD_LABELS[method] ?? method).join(', ')} · accepted ${formatDateTime(contact.acceptedAt)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {open ? (
        <Section id="close" ta="கோரிக்கையை மூடுதல்" en="Close the request" intro="Donors who have not answered can then no longer answer.">
          <SimpleForm
            id="close-request"
            action={closeRequest}
            hidden={{ requestId: request.id }}
            fields={[
              {
                name: 'outcome',
                label: 'Outcome',
                kind: 'radio',
                required: true,
                options: OUTCOMES.map((key) => ({ value: key, label: `${OUTCOME_LABELS[key].ta} · ${OUTCOME_LABELS[key].en}` })),
              },
            ]}
            submits={[{ label: 'Close the request' }]}
            targets={BLOOD_TARGETS}
          />
        </Section>
      ) : null}
    </div>
  );
}
