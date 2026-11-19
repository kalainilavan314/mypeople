import { ApiError, type Shelter } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { Both, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import { addShelter, updateShelter } from '@/features/disaster/actions';
import { DisasterNav } from '@/features/disaster/DisasterNav';
import { SAFETY_TARGETS, SHELTER_SOURCES, SHELTER_STATUSES, SHELTER_STATUS_LABELS } from '@/features/disaster/forms';
import { divisionOptions } from '@/features/disaster/places';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime, toSriLankaDateTimeInput } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Shelter information needs the disaster relay permission (disaster.relay, PRM-53).';
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const STATUS_TONES = { open: 'done', full: 'waiting', closed: 'neutral' } as const;

function shelterFields(defaults: Partial<Record<string, string>> = {}): FieldSpec[] {
  return [
    { name: 'nameTa', label: 'Name in Tamil', lang: 'ta', required: true, minLength: 3, maxLength: 220, defaultValue: defaults.nameTa },
    { name: 'nameEn', label: 'Name in English', lang: 'en', required: true, minLength: 3, maxLength: 160, defaultValue: defaults.nameEn },
    { name: 'placeTa', label: 'Where it is, in Tamil', lang: 'ta', required: true, minLength: 3, maxLength: 450, defaultValue: defaults.placeTa },
    { name: 'placeEn', label: 'Where it is, in English', lang: 'en', required: true, minLength: 3, maxLength: 300, defaultValue: defaults.placeEn },
    {
      name: 'status',
      label: 'Status',
      kind: 'radio',
      required: true,
      options: SHELTER_STATUSES.map((key) => ({ value: key, label: `${SHELTER_STATUS_LABELS[key].ta} · ${SHELTER_STATUS_LABELS[key].en}` })),
      defaultValue: defaults.status ?? 'open',
    },
    { name: 'capacity', label: 'Capacity (people)', kind: 'number', min: 1, max: 100000, defaultValue: defaults.capacity },
    {
      name: 'sourceKey',
      label: 'Authorised source',
      kind: 'select',
      required: true,
      options: SHELTER_SOURCES.map((source) => ({ value: source.key, label: `${source.ta} · ${source.en}` })),
      defaultValue: defaults.sourceKey,
    },
    {
      name: 'sourceUrl',
      label: 'Link to the source’s list, if it published one',
      kind: 'url',
      maxLength: 500,
      hint: 'https only, on the source’s own website.',
      defaultValue: defaults.sourceUrl,
      mono: true,
    },
    {
      name: 'sourceReportedAt',
      label: 'When the source reported this (Sri Lanka time)',
      kind: 'datetime',
      required: true,
      hint: 'Members see a report older than 12 hours marked “may be out of date”.',
      defaultValue: defaults.sourceReportedAt,
    },
  ];
}

/** D26: shelter information from authorised sources only, with the time each reported (FR-DIS-006). */
export default function SheltersPage(props: PageProps<'/disaster/shelters'>) {
  return (
    <>
      <PageHeader ta="பாதுகாப்பு நிலையங்கள்" en="Shelters" />
      <DisasterNav current="/disaster/shelters" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Shelters searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Shelters({ searchParams }: { searchParams: PageProps<'/disaster/shelters'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  if (!staff.permissions.has('disaster.relay')) return <PageProblem locale={locale} message={REFUSED} />;
  let shelters: Shelter[];
  try {
    shelters = await (await staffApi()).listManagedShelters();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Disaster alerts" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The shelters are not available." />;
  }
  const [areaNames, divisions] = await Promise.all([
    loadAreaNames(shelters.map((shelter) => shelter.areaKey)),
    divisionOptions(staff, 'disaster.relay'),
  ]);
  const shelterAreas = divisions.filter((option) => !option.value.startsWith('district:'));

  return (
    <div className="flex flex-col gap-6">
      <Feedback done={one(query.done)} />
      <Section id="shelters" ta="பதியப்பட்ட நிலையங்கள்" en={`Shelters in your areas (${shelters.length})`} intro="Update a shelter whenever its source reports again.">
        {shelters.length === 0 ? (
          <p className="text-sm text-muted">No shelters recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {shelters.map((shelter) => (
              <li key={shelter.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <BilingualTag label={SHELTER_STATUS_LABELS[shelter.status]} tone={STATUS_TONES[shelter.status]} />
                  {shelter.outOfDate ? <BilingualTag label={{ ta: 'பழைய தகவலாக இருக்கலாம்', en: 'May be out of date' }} tone="waiting" /> : null}
                  <span className="text-xs text-muted">{areaText(shelter.areaKey, areaNames, 'en')}</span>
                </div>
                <Both ta={shelter.nameTa} en={shelter.nameEn} />
                <Both ta={shelter.placeTa} en={shelter.placeEn} />
                <p className="text-xs text-muted">
                  {shelter.sourceNameEn}, reported {formatDateTime(shelter.sourceReportedAt)}
                  {shelter.capacity ? ` · room for ${shelter.capacity}` : ''}
                </p>
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Update from a new report</summary>
                  <SimpleForm
                    id={`shelter-${shelter.id.slice(0, 8)}`}
                    action={updateShelter}
                    hidden={{ shelterId: shelter.id }}
                    fields={shelterFields({
                      nameTa: shelter.nameTa,
                      nameEn: shelter.nameEn,
                      placeTa: shelter.placeTa,
                      placeEn: shelter.placeEn,
                      status: shelter.status,
                      capacity: shelter.capacity ? String(shelter.capacity) : undefined,
                      sourceKey: shelter.sourceKey,
                      sourceUrl: shelter.sourceUrl ?? undefined,
                      sourceReportedAt: toSriLankaDateTimeInput(new Date().toISOString()),
                    })}
                    submits={[{ label: 'Save the new report' }]}
                    targets={SAFETY_TARGETS}
                  />
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section id="new-shelter" ta="புதிய பாதுகாப்பு நிலையம்" en="Add a shelter" intro="Only from the Disaster Management Centre or a District or Divisional Secretariat.">
        <SimpleForm
          id="add-shelter"
          action={addShelter}
          fields={[
            {
              name: 'area',
              label: 'DS or GN division',
              kind: 'select',
              options: [{ value: '', label: 'Another division (type its key below)' }, ...shelterAreas],
            },
            { name: 'otherArea', label: 'Or the division’s key', hint: 'gn:CODE or ds:CODE inside your areas.', mono: true, maxLength: 40 },
            ...shelterFields({ sourceReportedAt: toSriLankaDateTimeInput(new Date().toISOString()) }),
          ]}
          submits={[{ label: 'Add the shelter' }]}
          targets={SAFETY_TARGETS}
        />
      </Section>
    </div>
  );
}
