import type { FieldSpec } from '@/components/SimpleForm';

import { ALERT_SOURCES, HAZARDS, HAZARD_LABELS, SEVERITIES, SEVERITY_LABELS } from './forms';

type Defaults = Partial<Record<string, string>>;

/** The source's own link, times, severity and text: what a relay and every later check carry (FR-DIS-001, 008). */
export function alertTextFields(defaults: Defaults = {}): FieldSpec[] {
  return [
    {
      name: 'sourceUrl',
      label: 'Link to the warning on the source’s own website',
      kind: 'url',
      required: true,
      maxLength: 500,
      hint: 'https only, on dmc.gov.lk or meteo.gov.lk. Never a social media post or a forward.',
      defaultValue: defaults.sourceUrl,
      wide: true,
      mono: true,
    },
    { name: 'sourceIssuedAt', label: 'Issued by the source at (Sri Lanka time)', kind: 'datetime', required: true, defaultValue: defaults.sourceIssuedAt },
    {
      name: 'sourceEndsAt',
      label: 'Ends at the source’s end time (Sri Lanka time)',
      kind: 'datetime',
      required: true,
      hint: 'At most 14 days after it was issued. It moves to history at this time.',
      defaultValue: defaults.sourceEndsAt,
    },
    {
      name: 'severity',
      label: 'Severity, as the source gives it',
      kind: 'radio',
      required: true,
      options: SEVERITIES.map((key) => ({ value: key, label: `${SEVERITY_LABELS[key].ta} · ${SEVERITY_LABELS[key].en}` })),
      defaultValue: defaults.severity,
    },
    { name: 'titleTa', label: 'Title in Tamil', lang: 'ta', required: true, minLength: 5, maxLength: 220, defaultValue: defaults.titleTa },
    { name: 'titleEn', label: 'Title in English', lang: 'en', required: true, minLength: 5, maxLength: 160, defaultValue: defaults.titleEn },
    {
      name: 'bodyTa',
      label: 'The source’s warning in Tamil',
      kind: 'textarea',
      lang: 'ta',
      required: true,
      minLength: 10,
      maxLength: 4500,
      rows: 5,
      hint: 'Keep to the source’s words and instructions. Add nothing of your own.',
      defaultValue: defaults.bodyTa,
    },
    {
      name: 'bodyEn',
      label: 'The source’s warning in English',
      kind: 'textarea',
      lang: 'en',
      required: true,
      minLength: 10,
      maxLength: 3000,
      rows: 5,
      defaultValue: defaults.bodyEn,
    },
  ];
}

/** Relay only: the official source, the hazard and the areas it targets. */
export function relayFields(ownAreas: readonly { value: string; label: string }[]): FieldSpec[] {
  return [
    {
      name: 'sourceKey',
      label: 'Official source',
      kind: 'select',
      required: true,
      options: ALERT_SOURCES.map((source) => ({ value: source.key, label: `${source.ta} · ${source.en}` })),
    },
    {
      name: 'hazard',
      label: 'Hazard',
      kind: 'select',
      required: true,
      options: HAZARDS.map((key) => ({ value: key, label: `${HAZARD_LABELS[key].ta} · ${HAZARD_LABELS[key].en}` })),
    },
    ...alertTextFields(),
    ...(ownAreas.length
      ? [{ name: 'ownAreas', label: 'Your areas it targets', kind: 'checks' as const, options: ownAreas }]
      : []),
    {
      name: 'moreAreas',
      label: 'Smaller areas it targets',
      hint: 'Area keys inside your areas, separated by commas: district:CODE, ds:CODE or gn:CODE. Members in these areas are told at once.',
      wide: true,
      mono: true,
      maxLength: 2000,
    },
  ];
}
