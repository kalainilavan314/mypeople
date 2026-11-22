import { ApiError, type ManagedCertificate } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { reissueCertificate, revokeCertificate } from '@/features/renewals/actions';
import { REISSUE_FIELDS, REVOKE_FIELDS } from '@/features/renewals/fields';
import { CERTIFICATE_TARGETS, KIND_LABELS, STATUS_LABELS, STATUS_TONES, searchRef } from '@/features/renewals/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const NOT_FOUND = 'This certificate does not exist or its holder is outside your areas.';
const REFUSED = 'Certificates need certificate issuing and revoking (certificate.issue_revoke).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D25: one certificate, what it says, and revoking or reissuing it with a reason (FR-RNW-008). */
export default function CertificatePage(props: PageProps<'/renewals/certificates/[ref]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={6} />}>
      <CertificateView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CertificateView({
  params,
  searchParams,
}: Pick<PageProps<'/renewals/certificates/[ref]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { ref: rawRef } = await params;
  const query = await searchParams;
  const ref = searchRef(decodeURIComponent(rawRef))?.toUpperCase();
  const backLink = <BackLink href="/renewals#certificates">Back to renewals and certificates</BackLink>;
  if (!ref || !ref.startsWith('CT-')) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }

  let certificate: ManagedCertificate | undefined;
  try {
    certificate = (await (await staffApi()).listCertificates({ ref })).find((item) => item.certificateRef === ref);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="Renewal and certificates" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }
  if (!certificate) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  const areaNames = await loadAreaNames([certificate.areaKey]);
  const { details } = certificate;
  const hidden = { certificateId: certificate.id, certificateRef: certificate.certificateRef };

  return (
    <>
      {backLink}
      <PageHeader ta={`சான்றிதழ் ${certificate.certificateRef}`} en={`Certificate ${certificate.certificateRef}`} />
      <Feedback done={one(query.done)} />
      <Section id="certificate" ta={KIND_LABELS[certificate.kind].ta} en={KIND_LABELS[certificate.kind].en}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Detail label="Status">
            <span className="flex flex-col gap-1">
              <BilingualTag label={STATUS_LABELS[certificate.status]} tone={STATUS_TONES[certificate.status]} />
              {certificate.statusReason ? <span className="text-muted">Reason: {certificate.statusReason}</span> : null}
            </span>
          </Detail>
          <Detail label="Holder">{certificate.holderName}</Detail>
          <Detail label="Member ID">
            <span className="font-mono">{certificate.memberCode}</span>
          </Detail>
          <Detail label="Area">{areaText(certificate.areaKey, areaNames, locale)}</Detail>
          <Detail label="Issued on">{formatDate(certificate.issuedOn)}</Detail>
          {details.memberSince ? <Detail label="Member since">{formatDate(details.memberSince)}</Detail> : null}
          {details.eventRef ? (
            <Detail label="Event">
              <span className="flex flex-col gap-1">
                <Both ta={details.eventTitleTa} en={details.eventTitleEn} />
                <span className="text-xs text-muted">
                  <span className="font-mono">{details.eventRef}</span> · {formatDate(details.eventDate)}
                </span>
              </span>
            </Detail>
          ) : null}
        </dl>
        {details.assignments && details.assignments.length > 0 ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold text-text">
              Completed volunteer assignments: {details.assignmentCount ?? details.assignments.length}
            </p>
            <ul className="flex flex-col gap-2">
              {details.assignments.map((assignment) => (
                <li key={`${assignment.ref}-${assignment.date}`} className="rounded-lg border border-line p-3">
                  <BilingualText ta={assignment.titleTa} en={assignment.titleEn} />
                  <span className="text-xs text-muted">
                    {assignment.roleEn} · <span className="font-mono">{assignment.ref}</span> · {formatDate(assignment.date)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-muted">
          The public check page shows only the type, the issue date and Valid, Revoked or Superseded, with the holder&apos;s name only
          while the certificate is valid. Certificates never carry an NIC or passport number.
        </p>
      </Section>
      {certificate.status === 'valid' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SimpleForm
            id="revoke-certificate"
            title="Revoke · மீளப்பெறுதல்"
            intro="The certificate then checks as Revoked. The member is told and sees your reason."
            action={revokeCertificate}
            hidden={hidden}
            fields={REVOKE_FIELDS}
            submits={[{ label: 'Revoke certificate', tone: 'danger' }]}
            targets={CERTIFICATE_TARGETS}
          />
          <SimpleForm
            id="reissue-certificate"
            title="Reissue · மீள வழங்குதல்"
            intro="A new certificate is made from the member's current records; this one then checks as Superseded. The member is told."
            action={reissueCertificate}
            hidden={hidden}
            fields={REISSUE_FIELDS}
            submits={[{ label: 'Reissue certificate' }]}
            targets={CERTIFICATE_TARGETS}
          />
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-card shadow-card p-4 text-sm text-muted">
          Only a valid certificate can be revoked or reissued. To give this member a new one, issue it from the renewals page.
        </p>
      )}
    </>
  );
}
