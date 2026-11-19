import { ApiError, type BloodDesk, type BloodDeskAccess, type BloodOversight, type BloodRequest, type Place } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { NotSwitchedOn, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { SimpleForm } from '@/components/SimpleForm';
import {
  addPartner,
  authoriseRequester,
  decideRequest,
  raiseRequest,
  revokeRequester,
  setPartnerActive,
} from '@/features/blood-requests/actions';
import {
  BLOOD_GROUPS,
  BLOOD_TARGETS,
  hoursFromNow,
  OUTCOME_LABELS,
  PARTNER_KIND_LABELS,
  REQUEST_STATE_LABELS,
  stateKey,
  URGENCIES,
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
 * D27 Blood request desk. Authorised partner accounts (hospitals, the blood transfusion service; PRM-55)
 * raise requests and see counts, plus the contact of each donor who accepted and consented. Tier 5
 * (donor.oversight) authorises partners and their requesters, decides requests over the hourly limit and
 * reads the requests with counts only. Nobody can list or search donors (FR-BLD-002), and medical
 * eligibility is for the hospital's own staff (OS-15).
 */
export default function BloodRequestsPage(props: PageProps<'/blood-requests'>) {
  return (
    <>
      <PageHeader ta="இரத்தக் கோரிக்கை மேசை" en="Blood request desk" />
      <p className="max-w-3xl text-sm text-muted">
        Donors are told privately; you see only how many were told, accepted and declined, and the contact of a donor only after
        they accept and agree to share it. Whether a donor can give, and compatibility, are decided by your qualified staff.
      </p>
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <Desk searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Desk({ searchParams }: { searchParams: PageProps<'/blood-requests'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const client = await staffApi();
  let access: BloodDeskAccess;
  try {
    access = await client.getBloodDeskAccess();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="The blood donor network" />;
    return <LoadFailure error={error} locale={locale} refused="Not available." notFound="The blood request desk is not available." />;
  }
  if (!access.partner && !access.oversight) {
    return (
      <PageProblem
        locale={locale}
        message="This desk is for accounts a hospital or the blood transfusion service has been authorised for, and for Tier 5 oversight (donor.oversight)."
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <Feedback done={one(query.done)} />
      {access.partner ? <PartnerDesk /> : null}
      {access.oversight ? <OversightDesk /> : null}
    </div>
  );
}

async function PartnerDesk() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const client = await staffApi();
  let desk: BloodDesk;
  let districts: Place[];
  try {
    [desk, districts] = await Promise.all([client.getBloodDesk(), client.listDistricts()]);
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused="Your account is not an authorised requester." notFound="The desk is not available." />;
  }
  const areaNames = await loadAreaNames(desk.requests.map((request) => request.areaKey));
  const defaultDistrict = desk.partner.districtKey.startsWith('district:') ? desk.partner.districtKey.slice('district:'.length) : undefined;
  return (
    <>
      <Section
        id="raise"
        ta="புதிய கோரிக்கை"
        en={`New request for ${desk.partner.name}`}
        intro={`Matching available donors in the area are told privately, at most once a day each. More than ${desk.requestsPerHour} requests in an hour wait for Tier 5 approval. Never enter a patient's name or details.`}>
        <SimpleForm
          id="raise-request"
          action={raiseRequest}
          fields={[
            {
              name: 'bloodGroup',
              label: 'Blood group needed',
              kind: 'select',
              required: true,
              options: BLOOD_GROUPS.map((group) => ({ value: group, label: group })),
              hint: 'Donors of exactly this group are told. Your staff decide compatibility.',
            },
            { name: 'units', label: 'Units needed', kind: 'number', required: true, min: 1, max: 20, defaultValue: '1' },
            {
              name: 'districtCode',
              label: 'District',
              kind: 'select',
              required: true,
              defaultValue: defaultDistrict,
              options: districts.map((district) => ({ value: district.code, label: `${district.nameTa ?? district.code} · ${district.nameEn ?? district.code}` })),
            },
            { name: 'dsCode', label: 'DS division code (optional)', hint: 'Only to narrow it to one DS division.', mono: true, maxLength: 20 },
            {
              name: 'urgency',
              label: 'Urgency',
              kind: 'radio',
              required: true,
              defaultValue: 'urgent',
              options: URGENCIES.map((key) => ({ value: key, label: `${URGENCY_LABELS[key].ta} · ${URGENCY_LABELS[key].en}` })),
            },
            {
              name: 'neededBy',
              label: 'Needed by (Sri Lanka time)',
              kind: 'datetime',
              required: true,
              hint: 'Within the next 14 days.',
              defaultValue: hoursFromNow(12),
            },
          ]}
          submits={[{ label: 'Send to matching donors' }]}
          targets={BLOOD_TARGETS}
        />
      </Section>
      <RecordTable
        caption="Your organisation's requests"
        locale={locale}
        rows={desk.requests}
        rowKey={(row) => row.id}
        refHeader="Reference"
        href={(row) => `/blood-requests/${row.id}`}
        linkText={(row) => row.requestRef}
        empty="No requests yet."
        columns={requestColumns(areaNames)}
      />
    </>
  );
}

function requestColumns(areaNames: Awaited<ReturnType<typeof loadAreaNames>>) {
  return [
    {
      header: 'State',
      cell: (row: BloodRequest) => (
        <span className="flex flex-col gap-1">
          <BilingualTag label={REQUEST_STATE_LABELS[stateKey(row.state, row.expired)] ?? { ta: row.state, en: row.state }} />
          {row.outcome ? <span className="text-xs text-muted">{OUTCOME_LABELS[row.outcome].en}</span> : null}
        </span>
      ),
    },
    {
      header: 'Request',
      cell: (row: BloodRequest) => (
        <span className="flex flex-col gap-1">
          <span className="font-semibold text-text">{`${row.bloodGroup} · ${row.units} units`}</span>
          <BilingualTag label={URGENCY_LABELS[row.urgency]} tone={URGENCY_TONES[row.urgency]} />
        </span>
      ),
    },
    { header: 'Area', cell: (row: BloodRequest) => <span className="text-xs text-muted">{areaText(row.areaKey, areaNames, 'en')}</span> },
    { header: 'Needed by', cell: (row: BloodRequest) => <span className="text-xs tabular-nums text-muted">{formatDateTime(row.neededBy)}</span> },
    {
      header: 'Donors',
      cell: (row: BloodRequest) => (
        <span className="flex flex-col text-xs tabular-nums text-muted">
          <span>{row.notified} told</span>
          <span>{row.accepted} accepted</span>
          <span>{row.declined} declined</span>
        </span>
      ),
    },
  ];
}

async function OversightDesk() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const client = await staffApi();
  let oversight: BloodOversight;
  let districts: Place[];
  try {
    [oversight, districts] = await Promise.all([client.getBloodOversight(), client.listDistricts()]);
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused="Oversight needs donor.oversight (Tier 5)." notFound="The oversight is not available." />;
  }
  const areaNames = await loadAreaNames([
    ...oversight.partners.map((partner) => partner.districtKey),
    ...oversight.recent.map((request) => request.areaKey),
    ...oversight.awaiting.map((request) => request.areaKey),
  ]);
  return (
    <>
      <Section
        id="awaiting"
        ta="அங்கீகாரத்துக்காகக் காத்திருப்பவை"
        en={`Requests over the hourly limit (${oversight.awaiting.length})`}
        intro="A partner sent more than the hourly limit. Approve to tell matching donors, or refuse with the reason. You cannot decide a request you raised.">
        {oversight.awaiting.length === 0 ? (
          <p className="text-sm text-muted">Nothing is waiting.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {oversight.awaiting.map((request) => (
              <li key={request.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{request.requestRef}</span>
                  <span>{`${request.partnerName} · ${request.bloodGroup} · ${request.units} units · ${areaText(request.areaKey, areaNames, 'en')}`}</span>
                  <BilingualTag label={URGENCY_LABELS[request.urgency]} tone={URGENCY_TONES[request.urgency]} />
                </p>
                <p className="text-xs text-muted">Needed by {formatDateTime(request.neededBy)} · raised {formatDateTime(request.createdAt)}</p>
                <SimpleForm
                  id={`decide-${request.id.slice(0, 8)}`}
                  action={decideRequest}
                  hidden={{ requestId: request.id }}
                  fields={[
                    {
                      name: 'decision',
                      label: 'Decision',
                      kind: 'radio',
                      required: true,
                      options: [
                        { value: 'approve', label: 'அங்கீகரி · Approve' },
                        { value: 'refuse', label: 'மறு · Refuse' },
                      ],
                    },
                    { name: 'reason', label: 'Reason', kind: 'textarea', maxLength: 500, showWhen: { field: 'decision', values: ['refuse'] } },
                  ]}
                  submits={[{ label: 'Record the decision' }]}
                  targets={BLOOD_TARGETS}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="partners" ta="பங்காளர் நிறுவனங்கள்" en={`Partner organisations (${oversight.partners.length})`} intro="Only organisations with a signed agreement (DEP-18). Each requester is a named, identity-verified account of the partner.">
        {oversight.partners.length === 0 ? (
          <p className="text-sm text-muted">No partners yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {oversight.partners.map((partner) => {
              const requesters = oversight.requesters.filter((r) => r.partnerId === partner.id && !r.revokedAt);
              return (
                <li key={partner.id} className="flex flex-col gap-3 rounded-lg border border-line p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text">{partner.name}</span>
                    <BilingualTag label={PARTNER_KIND_LABELS[partner.kind]} />
                    <BilingualTag label={partner.active ? { ta: 'செயலில்', en: 'Active' } : { ta: 'இடைநிறுத்தப்பட்டது', en: 'Suspended' }} tone={partner.active ? 'done' : 'neutral'} />
                  </p>
                  <p className="text-xs text-muted">
                    {areaText(partner.districtKey, areaNames, 'en')} · agreement {partner.agreementRef}
                  </p>
                  {requesters.length === 0 ? (
                    <p className="text-xs text-muted">No authorised requesters.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {requesters.map((requester) => (
                        <li key={requester.id} className="flex flex-wrap items-center gap-3">
                          <span>{`${requester.fullName} (${requester.memberCode})`}</span>
                          <SimpleForm
                            id={`revoke-${requester.id.slice(0, 8)}`}
                            action={revokeRequester}
                            hidden={{ requesterId: requester.id }}
                            fields={[]}
                            submits={[{ label: 'Revoke', tone: 'danger' }]}
                            targets={BLOOD_TARGETS}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {partner.active ? (
                      <SimpleForm
                        id={`requester-${partner.id.slice(0, 8)}`}
                        title="Authorise a requester"
                        action={authoriseRequester}
                        hidden={{ partnerId: partner.id }}
                        fields={[{ name: 'memberCode', label: 'Their member code', required: true, mono: true, maxLength: 40 }]}
                        submits={[{ label: 'Authorise' }]}
                        targets={BLOOD_TARGETS}
                      />
                    ) : null}
                    <SimpleForm
                      id={`active-${partner.id.slice(0, 8)}`}
                      title={partner.active ? 'Suspend the partner' : 'Reactivate the partner'}
                      intro={partner.active ? 'Its requesters can no longer raise requests.' : 'Its requesters can raise requests again.'}
                      action={setPartnerActive}
                      hidden={{ partnerId: partner.id, active: partner.active ? '0' : '1' }}
                      fields={[]}
                      submits={[{ label: partner.active ? 'Suspend' : 'Reactivate', tone: partner.active ? 'danger' : 'primary' }]}
                      targets={BLOOD_TARGETS}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="new-partner" ta="புதிய பங்காளர்" en="Register a partner">
        <SimpleForm
          id="add-partner"
          action={addPartner}
          fields={[
            { name: 'name', label: 'Organisation', required: true, minLength: 3, maxLength: 200 },
            {
              name: 'kind',
              label: 'Kind',
              kind: 'radio',
              required: true,
              options: [
                { value: 'hospital', label: `${PARTNER_KIND_LABELS.hospital.ta} · ${PARTNER_KIND_LABELS.hospital.en}` },
                { value: 'blood_bank', label: `${PARTNER_KIND_LABELS.blood_bank.ta} · ${PARTNER_KIND_LABELS.blood_bank.en}` },
              ],
            },
            {
              name: 'districtCode',
              label: 'District',
              kind: 'select',
              required: true,
              options: districts.map((district) => ({ value: district.code, label: `${district.nameTa ?? district.code} · ${district.nameEn ?? district.code}` })),
            },
            { name: 'agreementRef', label: 'Signed agreement reference', required: true, minLength: 3, maxLength: 120, mono: true },
          ]}
          submits={[{ label: 'Register the partner' }]}
          targets={BLOOD_TARGETS}
        />
      </Section>

      <Section id="recent" ta="அண்மைய கோரிக்கைகள்" en={`Recent requests (${oversight.recent.length})`} intro="Counts only. Requests are deleted 12 months after they were raised.">
        {oversight.recent.length === 0 ? (
          <p className="text-sm text-muted">No requests yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {oversight.recent.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-mono font-semibold">{request.requestRef}</span>
                <BilingualTag label={REQUEST_STATE_LABELS[stateKey(request.state, request.expired)] ?? { ta: request.state, en: request.state }} />
                <span className="text-xs text-muted">
                  {`${request.partnerName} · ${request.bloodGroup} · ${request.units} units · ${request.notified} told, ${request.accepted} accepted, ${request.declined} declined · ${formatDateTime(request.createdAt)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
