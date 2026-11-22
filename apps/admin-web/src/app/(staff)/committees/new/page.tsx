import { ApiError, type CommitteeAdmin } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure } from '@/components/PageProblem';
import { BackLink, NotSwitchedOn } from '@/components/PageSection';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import { proposeCommittee } from '@/features/committees/actions';
import { COMMITTEE_TARGETS, WING_LABELS, WING_TYPES } from '@/features/committees/forms';
import { areaOptionsFor } from '@/lib/areas';
import { getAdminLocale } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

/** D23: propose a wing, or a committee inside an approved wing. It opens to members once a Tier 5 approves it. */
export default function NewCommitteePage() {
  return (
    <>
      <BackLink href="/committees">Back to committees and wings</BackLink>
      <PageHeader ta="புதிய அணி அல்லது குழு" en="Propose a wing or committee" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewCommittee />
      </Suspense>
    </>
  );
}

async function NewCommittee() {
  await connection();
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let wings: CommitteeAdmin[];
  try {
    wings = (await (await staffApi()).listAdminCommittees({ state: 'active' })).filter((item) => item.kind === 'wing');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Committees and wings" />;
    return <LoadFailure error={error} locale={locale} refused="Proposing a wing or committee needs roles.assign or system.configure." notFound="Not available." />;
  }
  const platform = staff.assignments.some(
    (a) => a.area.level === 'platform' && (a.permissions.includes('roles.assign') || a.permissions.includes('system.configure')),
  );
  const own = await areaOptionsFor(staff.assignments, 'roles.assign');
  const areaOptions = [
    ...(platform ? [{ value: 'platform', label: 'முழு இயக்கமும் · Whole movement' }] : []),
    ...own,
    { value: 'other', label: 'A smaller area inside yours (type its code)' },
  ];
  const fields: FieldSpec[] = [
    {
      name: 'kind',
      label: 'Wing or committee',
      kind: 'radio',
      required: true,
      options: [
        { value: 'wing', label: 'அணி · Wing' },
        { value: 'committee', label: 'குழு · Committee inside an approved wing' },
      ],
    },
    {
      name: 'wingType',
      label: 'Type of wing',
      kind: 'select',
      required: true,
      options: WING_TYPES.map((code) => ({ value: code, label: `${WING_LABELS[code].ta} · ${WING_LABELS[code].en}` })),
    },
    {
      name: 'wingId',
      label: 'The approved wing it belongs to (same type)',
      kind: 'select',
      required: true,
      options: wings.map((wing) => ({ value: wing.id, label: `${wing.nameTa} · ${wing.nameEn} (${wing.committeeRef})` })),
      showWhen: { field: 'kind', values: ['committee'] },
      hint: wings.length === 0 ? 'No wing is approved yet: propose the wing first.' : undefined,
    },
    { name: 'nameTa', label: 'Name in Tamil', lang: 'ta', required: true, minLength: 3, maxLength: 160 },
    { name: 'nameEn', label: 'Name in English', lang: 'en', required: true, minLength: 3, maxLength: 120 },
    { name: 'purposeTa', label: 'Purpose in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 10, maxLength: 1500, wide: true },
    { name: 'purposeEn', label: 'Purpose in English', kind: 'textarea', lang: 'en', required: true, minLength: 10, maxLength: 1000, wide: true },
    {
      name: 'area',
      label: 'Its scope: the area it serves',
      kind: 'select',
      required: true,
      options: areaOptions,
      hint: 'Members in this area can apply. A diaspora committee is usually for the whole movement.',
    },
    {
      name: 'areaOther',
      label: 'Area code',
      hint: 'For example district:LK41 or ds:LK4103. It must lie inside one of your areas.',
      mono: true,
      maxLength: 30,
      showWhen: { field: 'area', values: ['other'] },
    },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card shadow-card p-4 sm:p-6">
      <p className="text-sm text-muted">
        A proposal opens to members only after a Tier 5 approves it (FR-COM-001). The youth wing is for members aged 18 and over
        (OD-15).
      </p>
      <SimpleForm
        id="committee-proposal"
        action={proposeCommittee}
        fields={fields}
        submits={[{ label: 'Send for Tier 5 approval' }]}
        targets={COMMITTEE_TARGETS}
      />
    </div>
  );
}
