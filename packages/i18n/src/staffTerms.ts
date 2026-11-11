// What staff see instead of permission codes and area codes, Tamil first. Shared by the staff app
// and the admin dashboard so both use the same words. The permission codes come from the API's
// catalogue (services/api/app/core/permissions.py); test/staffTerms.test.ts fails when a code there
// has no name here.

export type StaffLanguage = 'ta' | 'en';
export type StaffTerm = { readonly ta: string; readonly en: string };

export const permissionNames: Readonly<Record<string, StaffTerm>> = {
  'members.view_profile': { ta: 'உறுப்பினர் சுயவிவரங்களைப் பார்த்தல்', en: 'View member profiles' },
  'members.view_identity_evidence': { ta: 'அடையாள ஆவணங்களைப் பார்த்தல்', en: 'View identity documents' },
  'members.verify': { ta: 'உறுப்பினர் அடையாளத்தைச் சரிபார்த்தல்', en: 'Verify member identities' },
  'members.activate': { ta: 'உறுப்புரிமையைச் செயற்படுத்துதல்', en: 'Activate memberships' },
  'roles.assign': { ta: 'பணியாளர் பொறுப்புகளை ஒதுக்குதல்', en: 'Assign staff roles' },
  'cases.collect': { ta: 'சமூக விவகாரங்களைப் பதிவுசெய்தல்', en: 'Record community cases' },
  'cases.research': { ta: 'சமூக விவகாரங்களை ஆய்வுசெய்தல்', en: 'Research community cases' },
  'cases.decide_district': { ta: 'மாவட்ட மட்டத்தில் விவகாரங்களைத் தீர்மானித்தல்', en: 'Decide cases for the district' },
  'cases.plan_regional': { ta: 'விவகாரங்களுக்குப் பிராந்தியத் திட்டமிடல்', en: 'Plan regional responses to cases' },
  'cases.approve_executive': { ta: 'விவகாரங்களுக்கு நிறைவேற்று அங்கீகாரம் வழங்குதல்', en: 'Give executive approval to cases' },
  'cases.implement_and_close': { ta: 'விவகாரங்களைச் செயற்படுத்தி முடித்தல்', en: 'Carry out and close cases' },
  'cases.view_reporter_contact': { ta: 'விவகாரத்தைத் தெரிவித்தவரின் தொடர்பு விவரங்களைப் பார்த்தல்', en: 'See who reported a case' },
  'finance.review': { ta: 'கட்சி நிதிப் பங்களிப்புகளை மீளாய்வு செய்தல்', en: 'Review party fund contributions' },
  'finance.approve': { ta: 'கட்சி நிதிப் பங்களிப்புகளை அங்கீகரித்தல்', en: 'Approve party fund contributions' },
  'finance.export': { ta: 'நிதிப் பேரேட்டை ஏற்றுமதி செய்தல்', en: 'Export the finance ledger' },
  'finance.audit_read': { ta: 'தணிக்கைக்காக நிதிப் பதிவுகளைப் பார்த்தல்', en: 'Read finance records for audit' },
  'finance.publish_ledger': { ta: 'நிதிப் பேரேட்டை வெளியிடுதல்', en: 'Publish the finance ledger' },
  'events.manage': { ta: 'நிகழ்வுகளை நிர்வகித்தல்', en: 'Manage events' },
  'events.checkin_scan': { ta: 'நிகழ்வுகளில் வருகையைப் பதிவுசெய்தல்', en: 'Check people in at events' },
  'gallery.publish': { ta: 'புகைப்படத் தொகுப்புகளை வெளியிடுதல்', en: 'Publish photo albums' },
  'gallery.takedown': { ta: 'புகைப்படங்களை நீக்குதல்', en: 'Remove gallery photos' },
  'content.moderate': { ta: 'சமூக உள்ளடக்கத்தை நெறிப்படுத்துதல்', en: 'Moderate community content' },
  'notifications.send': { ta: 'அறிவித்தல்களை அனுப்புதல்', en: 'Send announcements' },
  'surveys.manage': { ta: 'கருத்துக்கணிப்புகளை நிர்வகித்தல்', en: 'Manage surveys' },
  'volunteers.manage': { ta: 'தன்னார்வலர்களை நிர்வகித்தல்', en: 'Manage volunteers' },
  'analytics.view': { ta: 'பகுப்பாய்வுகளைப் பார்த்தல்', en: 'View analytics' },
  'audit.view': { ta: 'தணிக்கைப் பதிவைப் பார்த்தல்', en: 'View the audit log' },
  'system.configure': { ta: 'கணினி அமைப்புகளை மாற்றுதல்', en: 'Configure the system' },
  'idv.screening.view': { ta: 'அடையாளச் சோதனை முடிவுகளைப் பார்த்தல்', en: 'View identity screening results' },
  'idv.duplicate.investigate': { ta: 'இரட்டைக் கணக்குகளை விசாரித்தல்', en: 'Investigate duplicate accounts' },
  'idv.appeal.decide': { ta: 'சரிபார்ப்பு மேன்முறையீடுகளைத் தீர்மானித்தல்', en: 'Decide verification appeals' },
  'ai.model.approve': { ta: 'AI மாதிரிகளை அங்கீகரித்தல்', en: 'Approve AI models' },
  'ai.model.monitor': { ta: 'AI மாதிரிகளைக் கண்காணித்தல்', en: 'Monitor AI models' },
  'household.view_for_case': { ta: 'விவகாரத்துக்காகக் குடும்ப விவரங்களைப் பார்த்தல்', en: 'View households for a case' },
  'assistance.intake': { ta: 'உதவிக் கோரிக்கைகளைப் பதிவுசெய்தல்', en: 'Take assistance requests' },
  'assistance.casework': { ta: 'உதவி விவகாரங்களைக் கையாளுதல்', en: 'Handle assistance cases' },
  'assistance.decide': { ta: 'உதவிக் கோரிக்கைகளைத் தீர்மானித்தல்', en: 'Decide assistance requests' },
  'assistance.programme.manage': { ta: 'உதவித் திட்டங்களை நிர்வகித்தல்', en: 'Manage assistance programmes' },
  'dev.review': { ta: 'அபிவிருத்தி முன்மொழிவுகளை மீளாய்வு செய்தல்', en: 'Review development proposals' },
  'dev.approve_planning': { ta: 'அபிவிருத்தித் திட்டமிடலை அங்கீகரித்தல்', en: 'Approve development planning' },
  'promise.edit': { ta: 'வாக்குறுதி கண்காணிப்பைத் திருத்துதல்', en: 'Edit the promise tracker' },
  'promise.publish': { ta: 'வாக்குறுதி நிலைகளை வெளியிடுதல்', en: 'Publish promise updates' },
  'scorecard.publish': { ta: 'மதிப்பீட்டு அட்டைகளை வெளியிடுதல்', en: 'Publish scorecards' },
  'townhall.produce': { ta: 'மக்கள் மன்றங்களை நடத்துதல்', en: 'Run town halls' },
  'townhall.moderate': { ta: 'மக்கள் மன்றங்களை நெறிப்படுத்துதல்', en: 'Moderate town halls' },
  'pb.manage': { ta: 'பங்கேற்பு வரவுசெலவுத் திட்டத்தை நிர்வகித்தல்', en: 'Manage participatory budgeting' },
  'pb.certify': { ta: 'பங்கேற்பு வரவுசெலவுத் திட்ட முடிவுகளை உறுதிப்படுத்துதல்', en: 'Certify budgeting results' },
  'election.mode.manage': { ta: 'தேர்தல் பயன்முறையை நிர்வகித்தல்', en: 'Manage election mode' },
  'election.roster.manage': { ta: 'தேர்தல் கடமைப் பட்டியலை நிர்வகித்தல்', en: 'Manage election duty rosters' },
  'field.collect': { ta: 'களத் தரவைச் சேகரித்தல்', en: 'Collect field data' },
  'certificate.issue_revoke': { ta: 'சான்றிதழ்களை வழங்குதலும் மீளப்பெறுதலும்', en: 'Issue and revoke certificates' },
  'disaster.relay': { ta: 'அதிகாரபூர்வ அனர்த்த எச்சரிக்கைகளை அனுப்புதல்', en: 'Relay official disaster alerts' },
  'relief.logistics': { ta: 'நிவாரண விநியோகத்தை நிர்வகித்தல்', en: 'Manage relief logistics' },
  'privacy.requests.handle': { ta: 'தனியுரிமைக் கோரிக்கைகளைக் கையாளுதல்', en: 'Handle privacy requests' },
  'reports.view': { ta: 'சமூகப் புகார்களைப் பார்த்தல்', en: 'View community reports' },
};

/** The permission's name in the language, or the code itself for one this table does not know yet. */
export function permissionName(code: string, language: StaffLanguage): string {
  return permissionNames[code]?.[language] ?? code;
}

export type AreaLevel = 'platform' | 'province' | 'district' | 'ds' | 'gn';

export const areaLevelNames: Readonly<Record<AreaLevel, StaffTerm>> = {
  platform: { ta: 'நாடு முழுவதும்', en: 'Platform-wide' },
  province: { ta: 'மாகாணம்', en: 'province' },
  district: { ta: 'மாவட்டம்', en: 'district' },
  ds: { ta: 'பிரதேச செயலகப் பிரிவு', en: 'DS division' },
  gn: { ta: 'கிராம அலுவலர் பிரிவு', en: 'GN division' },
};

/** An area as the API gives it: an object with a level and code, or a key such as "district:LK41". */
export type AreaLike = { readonly level: string; readonly code?: string | null } | string;

/** Names from GET /v1/geography/areas, by area key. Tamil names leave out the level word. */
export type AreaNames = ReadonlyMap<string, { readonly nameEn: string | null; readonly nameTa: string | null }>;

/** The lookup for areaName(), from the list GET /v1/geography/areas returns. */
export function areaNamesFrom(
  list: readonly { readonly key: string; readonly nameEn: string | null; readonly nameTa: string | null }[],
): AreaNames {
  return new Map(list.map((item) => [item.key, { nameEn: item.nameEn, nameTa: item.nameTa }]));
}

/** The keys worth looking up for these areas: each once, without "platform", which has no name. */
export function areaKeysToName(areas: readonly AreaLike[]): string[] {
  return [...new Set(areas.map(areaKey))].filter((key) => key !== 'platform' && key.includes(':')).sort();
}

/** "district:LK41", or "platform"; the key the API uses in area paths and the geography lookup. */
export function areaKey(area: AreaLike): string {
  if (typeof area === 'string') return area;
  return area.level === 'platform' ? 'platform' : `${area.level}:${area.code ?? ''}`;
}

/**
 * "Jaffna district" / "யாழ்ப்பாணம் மாவட்டம்". A GN division without a Tamil name keeps its
 * English one; an area the lookup did not name (or names not loaded) shows its code, as before.
 */
export function areaName(area: AreaLike, names: AreaNames | undefined, language: StaffLanguage): string {
  const key = areaKey(area);
  if (key === 'platform') return areaLevelNames.platform[language];
  const [level, code] = key.split(':', 2) as [string, string | undefined];
  const levelName = areaLevelNames[level as AreaLevel]?.[language] ?? level;
  const found = names?.get(key);
  const name = (language === 'ta' ? found?.nameTa : null) ?? found?.nameEn;
  return name ? `${name} ${levelName}` : `${levelName} ${code ?? ''}`.trim();
}
