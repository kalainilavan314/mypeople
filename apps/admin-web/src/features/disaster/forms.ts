import type {
  DisasterAlertRefreshInput,
  DisasterAlertRelayInput,
  DisasterHazard,
  DisasterSeverity,
  ReliefDistributionInput,
  ReliefItemKey,
  ReliefSupplyInput,
  ShelterCreateInput,
  ShelterInput,
  ShelterStatus,
} from '@my-people/api-client';

import { checked, colomboDateTime, readArea, text, wholeNumber, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal codes the alerts and relief APIs use, and the ones the dashboard's own checks use too. */
export const SAFETY_REFUSED = 'safety_refused';
export const RELIEF_REFUSED = 'relief_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };

export const SEVERITIES: readonly DisasterSeverity[] = ['advisory', 'watch', 'warning'];
export const SEVERITY_LABELS: Readonly<Record<DisasterSeverity, Words>> = {
  advisory: { ta: 'அறிவுறுத்தல்', en: 'Advisory' },
  watch: { ta: 'அவதானம்', en: 'Watch' },
  warning: { ta: 'எச்சரிக்கை', en: 'Warning' },
};
export const SEVERITY_TONES: Readonly<Record<DisasterSeverity, 'neutral' | 'waiting' | 'refused'>> = {
  advisory: 'neutral',
  watch: 'waiting',
  warning: 'refused',
};

export const HAZARDS: readonly DisasterHazard[] = [
  'flood', 'cyclone', 'heavy_rain', 'strong_wind', 'landslide', 'lightning', 'tsunami', 'drought', 'other',
];
export const HAZARD_LABELS: Readonly<Record<DisasterHazard, Words>> = {
  flood: { ta: 'வெள்ளம்', en: 'Flood' },
  cyclone: { ta: 'சூறாவளி', en: 'Cyclone' },
  heavy_rain: { ta: 'கடும் மழை', en: 'Heavy rain' },
  strong_wind: { ta: 'பலத்த காற்று', en: 'Strong wind' },
  landslide: { ta: 'மண்சரிவு', en: 'Landslide' },
  lightning: { ta: 'மின்னல்', en: 'Lightning' },
  tsunami: { ta: 'சுனாமி', en: 'Tsunami' },
  drought: { ta: 'வறட்சி', en: 'Drought' },
  other: { ta: 'வேறு அபாயம்', en: 'Other hazard' },
};

export const ALERT_STATE_LABELS: Readonly<Record<'current' | 'expired' | 'withdrawn', Words>> = {
  current: { ta: 'நடப்பில்', en: 'Current' },
  expired: { ta: 'முடிவடைந்தது', en: 'Ended' },
  withdrawn: { ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn' },
};

/** The official sources (INT-18): warnings only from the first two; shelters from the DMC and the secretariats. */
export const ALERT_SOURCES = [
  { key: 'dmc', ta: 'அனர்த்த முகாமைத்துவ நிலையம்', en: 'Disaster Management Centre', domain: 'dmc.gov.lk' },
  { key: 'meteorology', ta: 'வளிமண்டலவியல் திணைக்களம்', en: 'Department of Meteorology', domain: 'meteo.gov.lk' },
] as const;
export const SHELTER_SOURCES = [
  { key: 'dmc', ta: 'அனர்த்த முகாமைத்துவ நிலையம்', en: 'Disaster Management Centre', domain: 'dmc.gov.lk' },
  { key: 'district_secretariat', ta: 'மாவட்டச் செயலகம்', en: 'District Secretariat', domain: 'dist.gov.lk' },
  { key: 'divisional_secretariat', ta: 'பிரதேச செயலகம்', en: 'Divisional Secretariat', domain: 'ds.gov.lk' },
] as const;
type AlertSourceKey = (typeof ALERT_SOURCES)[number]['key'];
type ShelterSourceKey = (typeof SHELTER_SOURCES)[number]['key'];

export const SHELTER_STATUSES: readonly ShelterStatus[] = ['open', 'full', 'closed'];
export const SHELTER_STATUS_LABELS: Readonly<Record<ShelterStatus, Words>> = {
  open: { ta: 'திறந்துள்ளது', en: 'Open' },
  full: { ta: 'நிரம்பியுள்ளது', en: 'Full' },
  closed: { ta: 'மூடப்பட்டுள்ளது', en: 'Closed' },
};

export const RELIEF_TASK_LABELS: Readonly<Record<string, Words>> = {
  distribution: { ta: 'பொருட்களை வழங்குதல்', en: 'Handing out supplies' },
  cooking: { ta: 'சமைத்தல்', en: 'Cooking' },
  transport: { ta: 'போக்குவரத்து', en: 'Transport' },
  shelter_support: { ta: 'பாதுகாப்பு நிலைய உதவி', en: 'Shelter support' },
  cleaning: { ta: 'துப்புரவு', en: 'Cleaning' },
  loading: { ta: 'ஏற்றுதலும் சுமத்தலும்', en: 'Loading and carrying' },
  first_aid: { ta: 'முதலுதவி', en: 'First aid' },
};

export const SAFETY_TARGETS: ProblemTargets = {
  unofficial_source: 'sourceKey',
  unauthorised_shelter_source: 'sourceKey',
  link_not_from_source: 'sourceUrl',
  source_url_required: 'sourceUrl',
  issued_in_future: 'sourceIssuedAt',
  issued_required: 'sourceIssuedAt',
  issued_before_current: 'sourceIssuedAt',
  ends_before_issue: 'sourceEndsAt',
  ends_required: 'sourceEndsAt',
  already_ended: 'sourceEndsAt',
  alert_too_long: 'sourceEndsAt',
  hazard_required: 'hazard',
  severity_required: 'severity',
  title_required: 'titleTa',
  body_required: 'bodyTa',
  targets_required: 'ownAreas',
  too_many_targets: 'moreAreas',
  target_level: 'moreAreas',
  target_invalid: 'moreAreas',
  unknown_area: 'moreAreas',
  reason_required: 'reason',
  shelter_name_required: 'nameTa',
  shelter_place_required: 'placeTa',
  shelter_status_required: 'status',
  capacity_invalid: 'capacity',
  reported_required: 'sourceReportedAt',
  reported_in_future: 'sourceReportedAt',
  shelter_area_level: 'area',
  area_required: 'area',
};

export const RELIEF_TARGETS: ProblemTargets = {
  store_required: 'store',
  store_level: 'store',
  item_required: 'item',
  quantity_invalid: 'quantity',
  more_than_in_stock: 'quantity',
  supplier_required: 'supplier',
  date_required: 'day',
  date_in_future: 'day',
  date_too_old: 'day',
  area_required: 'area',
  unknown_area: 'area',
  delivery_level: 'area',
  outside_store_area: 'area',
  case_ref_invalid: 'caseRef',
  case_not_found: 'caseRef',
  group_details_required: 'groupSite',
  evidence_required: 'evidence',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CASE_REF = /^AS-[A-Z2-7]{8}$/;

/**
 * The areas an alert targets (FR-DIS-002): ticked areas of the relayer's own, and any further
 * "level:code" keys typed, separated by commas, spaces or new lines. Districts, DS and GN divisions only.
 */
export function readTargets(form: FormLike): { targets: { level: 'district' | 'ds' | 'gn'; code: string }[]; problems: string[] } {
  const typed = text(form, 'moreAreas').split(/[\s,]+/).filter(Boolean);
  const keys = [...new Set([...checked(form, 'ownAreas'), ...typed])];
  const targets: { level: 'district' | 'ds' | 'gn'; code: string }[] = [];
  const problems: string[] = [];
  for (const key of keys) {
    const area = readArea(key);
    if (!area) problems.push('target_invalid');
    else if (area.level === 'province') problems.push('target_level');
    else targets.push({ level: area.level, code: area.code });
  }
  if (keys.length === 0) problems.push('targets_required');
  if (keys.length > 50) problems.push('too_many_targets');
  return { targets, problems: [...new Set(problems)] };
}

function readAlertText(form: FormLike): { values: Omit<DisasterAlertRefreshInput, 'note'> | null; problems: string[] } {
  const severity = SEVERITIES.find((item) => item === text(form, 'severity'));
  const sourceUrl = text(form, 'sourceUrl');
  const issued = colomboDateTime(text(form, 'sourceIssuedAt'));
  const ends = colomboDateTime(text(form, 'sourceEndsAt'));
  const titleTa = text(form, 'titleTa');
  const titleEn = text(form, 'titleEn');
  const bodyTa = text(form, 'bodyTa');
  const bodyEn = text(form, 'bodyEn');
  const problems = [
    ...(sourceUrl.startsWith('https://') && sourceUrl.length >= 12 ? [] : ['source_url_required']),
    ...(issued ? [] : ['issued_required']),
    ...(ends ? [] : ['ends_required']),
    ...(issued && ends && ends <= issued ? ['ends_before_issue'] : []),
    ...(severity ? [] : ['severity_required']),
    ...(titleTa.length >= 5 && titleEn.length >= 5 ? [] : ['title_required']),
    ...(bodyTa.length >= 10 && bodyEn.length >= 10 ? [] : ['body_required']),
  ];
  if (problems.length > 0 || !severity || !issued || !ends) return { values: null, problems };
  return {
    values: { sourceUrl, sourceIssuedAt: issued, sourceEndsAt: ends, severity, titleTa, titleEn, bodyTa, bodyEn },
    problems,
  };
}

/** FR-DIS-001: an official source, its own link and issue time, its end time, and the text in both languages. */
export function readRelay(form: FormLike): Read<DisasterAlertRelayInput> {
  const sourceKey = ALERT_SOURCES.find((source) => source.key === text(form, 'sourceKey'))?.key as AlertSourceKey | undefined;
  const hazard = HAZARDS.find((item) => item === text(form, 'hazard'));
  const { values, problems: textProblems } = readAlertText(form);
  const { targets, problems: targetProblems } = readTargets(form);
  const problems = [
    ...(sourceKey ? [] : ['unofficial_source']),
    ...(hazard ? [] : ['hazard_required']),
    ...textProblems,
    ...targetProblems,
  ];
  if (problems.length > 0 || !sourceKey || !hazard || !values) return { input: null, problems };
  return { input: { ...values, sourceKey, hazard, targets }, problems };
}

/** FR-DIS-008: checked against the source again, with its latest link, times and text. */
export function readRefresh(form: FormLike): Read<DisasterAlertRefreshInput> {
  const { values, problems } = readAlertText(form);
  if (!values) return { input: null, problems };
  const note = text(form, 'note');
  return { input: { ...values, note: note || null }, problems };
}

/** FR-DIS-006: an authorised source and when it reported; a link only if the source published one. */
export function readShelter(form: FormLike, { needsArea }: { needsArea: boolean }): Read<ShelterCreateInput | ShelterInput> {
  const sourceKey = SHELTER_SOURCES.find((source) => source.key === text(form, 'sourceKey'))?.key as ShelterSourceKey | undefined;
  const status = SHELTER_STATUSES.find((item) => item === text(form, 'status'));
  const reported = colomboDateTime(text(form, 'sourceReportedAt'));
  const capacityText = text(form, 'capacity');
  const capacity = capacityText ? wholeNumber(capacityText, 1, 100000) : null;
  const sourceUrl = text(form, 'sourceUrl');
  // A division from the list, or one typed as "gn:CODE" when it is not listed.
  const area = readArea(text(form, 'area') || text(form, 'otherArea'));
  const problems = [
    ...(text(form, 'nameTa').length >= 3 && text(form, 'nameEn').length >= 3 ? [] : ['shelter_name_required']),
    ...(text(form, 'placeTa').length >= 3 && text(form, 'placeEn').length >= 3 ? [] : ['shelter_place_required']),
    ...(status ? [] : ['shelter_status_required']),
    ...(capacityText && capacity === null ? ['capacity_invalid'] : []),
    ...(sourceKey ? [] : ['unauthorised_shelter_source']),
    ...(sourceUrl && !sourceUrl.startsWith('https://') ? ['link_not_from_source'] : []),
    ...(reported ? [] : ['reported_required']),
    ...(needsArea && !area ? ['area_required'] : []),
    ...(needsArea && area && area.level !== 'ds' && area.level !== 'gn' ? ['shelter_area_level'] : []),
  ];
  if (problems.length > 0 || !status || !sourceKey || !reported) return { input: null, problems };
  const values: ShelterInput = {
    nameTa: text(form, 'nameTa'), nameEn: text(form, 'nameEn'), placeTa: text(form, 'placeTa'), placeEn: text(form, 'placeEn'),
    status, capacity, sourceKey, sourceUrl: sourceUrl || null, sourceReportedAt: reported,
  };
  if (!needsArea) return { input: values, problems };
  if (!area || (area.level !== 'ds' && area.level !== 'gn')) return { input: null, problems: ['area_required'] };
  return { input: { ...values, area: { level: area.level, code: area.code } }, problems };
}

/** D26: stock received into a District or DS store. */
export function readSupply(form: FormLike, items: readonly string[]): Read<ReliefSupplyInput> {
  const store = readArea(text(form, 'store'));
  const item = items.find((key) => key === text(form, 'item')) as ReliefItemKey | undefined;
  const quantity = wholeNumber(text(form, 'quantity'), 1, 1000000);
  const supplier = text(form, 'supplier');
  const day = text(form, 'day');
  const problems = [
    ...(store ? [] : ['store_required']),
    ...(store && store.level !== 'district' && store.level !== 'ds' ? ['store_level'] : []),
    ...(item ? [] : ['item_required']),
    ...(quantity === null ? ['quantity_invalid'] : []),
    ...(supplier.length >= 2 ? [] : ['supplier_required']),
    ...(DATE.test(day) ? [] : ['date_required']),
  ];
  if (problems.length > 0 || !store || !item || quantity === null || (store.level !== 'district' && store.level !== 'ds')) {
    return { input: null, problems };
  }
  return { input: { store: { level: store.level, code: store.code }, item, quantity, supplier, receivedOn: day, alertId: null }, problems };
}

/** S16 on the web: from a store, to a place inside it, for an AS- case or a group at a site; never a name. */
export function readDistribution(form: FormLike, items: readonly string[]): Read<ReliefDistributionInput> {
  const storeKey = text(form, 'storeKey');
  const store = readArea(storeKey);
  const area = readArea(text(form, 'area') || text(form, 'otherArea'));
  const item = items.find((key) => key === text(form, 'item')) as ReliefItemKey | undefined;
  const quantity = wholeNumber(text(form, 'quantity'), 1, 1000000);
  const kind = text(form, 'recipientKind') === 'case' ? 'case' : 'group';
  const caseRef = text(form, 'caseRef').toUpperCase();
  const groupSite = text(form, 'groupSite');
  const households = wholeNumber(text(form, 'households'), 1, 100000);
  const evidence = text(form, 'evidence');
  const day = text(form, 'day');
  const problems = [
    ...(store && (store.level === 'district' || store.level === 'ds') ? [] : ['store_required']),
    ...(area && area.level !== 'province' ? [] : ['area_required']),
    ...(item ? [] : ['item_required']),
    ...(quantity === null ? ['quantity_invalid'] : []),
    ...(kind === 'case' && !CASE_REF.test(caseRef) ? ['case_ref_invalid'] : []),
    ...(kind === 'group' && (groupSite.length < 3 || households === null) ? ['group_details_required'] : []),
    ...(evidence.length >= 3 ? [] : ['evidence_required']),
    ...(DATE.test(day) ? [] : ['date_required']),
  ];
  if (problems.length > 0 || !store || !area || area.level === 'province' || !item || quantity === null) {
    return { input: null, problems };
  }
  return {
    input: {
      storeKey, area: { level: area.level, code: area.code }, item, quantity, recipientKind: kind,
      caseRef: kind === 'case' ? caseRef : null, groupSite: kind === 'group' ? groupSite : null,
      households: kind === 'group' ? households : null, evidence, deliveredOn: day, alertId: null,
    },
    problems,
  };
}

/** Today in Sri Lankan time, for date fields. */
export function colomboToday(now: Date = new Date()): string {
  return new Date(now.getTime() + (5 * 60 + 30) * 60_000).toISOString().slice(0, 10);
}
