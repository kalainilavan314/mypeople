/** Community-service concerns only (FR-FLD-003); there is nothing political to record or show. */
export const CONCERN_LABELS: Readonly<Record<string, { ta: string; en: string }>> = {
  water: { ta: 'குடிநீர்', en: 'Water' },
  roads: { ta: 'வீதிகள்', en: 'Roads' },
  health: { ta: 'சுகாதாரம்', en: 'Health' },
  education: { ta: 'கல்வி', en: 'Education' },
  livelihood: { ta: 'வாழ்வாதாரம்', en: 'Livelihood' },
  housing: { ta: 'வீடமைப்பு', en: 'Housing' },
  electricity: { ta: 'மின்சாரம்', en: 'Electricity' },
  waste: { ta: 'கழிவு', en: 'Waste' },
  safety: { ta: 'பாதுகாப்பு', en: 'Safety' },
  elderly_care: { ta: 'முதியோர் பராமரிப்பு', en: 'Elderly care' },
  disability: { ta: 'மாற்றுத்திறன்', en: 'Disability' },
  other: { ta: 'ஏனையவை', en: 'Other' },
};

/**
 * Visits by place (rows) and concern (columns), from the API's counts. A place is an area key: a GN
 * or a DS division, or the coordinator's own area for a visit recorded without a place (S05).
 */
export function countsTable(counts: readonly { areaKey: string; concern: string; visits: number }[]): {
  places: string[];
  concerns: string[];
  count: (place: string, concern: string) => number;
} {
  const places = [...new Set(counts.map((row) => row.areaKey))].sort();
  const used = new Set(counts.map((row) => row.concern));
  const concerns = [...Object.keys(CONCERN_LABELS).filter((concern) => used.has(concern)), ...[...used].filter((concern) => !(concern in CONCERN_LABELS))];
  const cells = new Map(counts.map((row) => [`${row.areaKey}|${row.concern}`, row.visits]));
  return {
    places,
    concerns,
    count: (place, concern) => cells.get(`${place}|${concern}`) ?? 0,
  };
}

/** A visit's place for the oversight list: its GN or DS division, or that none was given. */
export function visitPlaceKey(visit: { gnCode?: string | null; dsCode?: string | null; areaKey: string }): { key: string; given: boolean } {
  if (visit.gnCode) return { key: `gn:${visit.gnCode}`, given: true };
  if (visit.dsCode) return { key: `ds:${visit.dsCode}`, given: true };
  return { key: visit.areaKey, given: false };
}
