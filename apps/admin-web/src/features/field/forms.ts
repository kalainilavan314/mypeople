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

/** Visits by GN division (rows) and concern (columns), from the API's counts. */
export function countsTable(counts: readonly { gnCode: string; concern: string; visits: number }[]): {
  gns: string[];
  concerns: string[];
  count: (gn: string, concern: string) => number;
} {
  const gns = [...new Set(counts.map((row) => row.gnCode))].sort();
  const used = new Set(counts.map((row) => row.concern));
  const concerns = [...Object.keys(CONCERN_LABELS).filter((concern) => used.has(concern)), ...[...used].filter((concern) => !(concern in CONCERN_LABELS))];
  const cells = new Map(counts.map((row) => [`${row.gnCode}|${row.concern}`, row.visits]));
  return {
    gns,
    concerns,
    count: (gn, concern) => cells.get(`${gn}|${concern}`) ?? 0,
  };
}
