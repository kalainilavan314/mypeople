import type { HouseholdMember, StaffHouseholdView } from '@my-people/api-client';

import { formatDate, formatDateTime } from '@/lib/format';
import type { Locale } from '@/lib/i18n/types';

type Bilingual = { ta: string; en: string };

const ROLE_LABELS: Record<string, Bilingual> = {
  head: { ta: 'குடும்பத் தலைவர்', en: 'Head of household' },
  adult: { ta: 'வயதுவந்த உறுப்பினர்', en: 'Adult member' },
  dependent: { ta: 'பிள்ளை', en: 'Child' },
};

const RELATIONSHIP_LABELS: Record<string, Bilingual> = {
  head: { ta: 'குடும்பத் தலைவர்', en: 'Head of household' },
  spouse: { ta: 'வாழ்க்கைத் துணை', en: 'Spouse' },
  parent: { ta: 'பெற்றோர்', en: 'Parent' },
  sibling: { ta: 'உடன்பிறப்பு', en: 'Sibling' },
  child: { ta: 'பிள்ளை', en: 'Child' },
  grandchild: { ta: 'பேரப்பிள்ளை', en: 'Grandchild' },
  other: { ta: 'பிற உறவினர்', en: 'Other relative' },
};

const AGE_BAND_LABELS: Record<string, Bilingual> = {
  '18_24': { ta: '18 முதல் 24', en: '18 to 24' },
  '25_34': { ta: '25 முதல் 34', en: '25 to 34' },
  '35_44': { ta: '35 முதல் 44', en: '35 to 44' },
  '45_54': { ta: '45 முதல் 54', en: '45 to 54' },
  '55_64': { ta: '55 முதல் 64', en: '55 to 64' },
  '65_plus': { ta: '65 அல்லது அதற்கு மேல்', en: '65 or over' },
};

const OCCUPATION_LABELS: Record<string, Bilingual> = {
  farming: { ta: 'விவசாயம்', en: 'Farming' },
  fishing: { ta: 'மீன்பிடி', en: 'Fishing' },
  daily_labour: { ta: 'நாட்கூலி வேலை', en: 'Daily labour' },
  trade: { ta: 'வணிகம்', en: 'Trade or business' },
  government: { ta: 'அரச சேவை', en: 'Government service' },
  private_sector: { ta: 'தனியார் துறை', en: 'Private sector' },
  self_employed: { ta: 'சுயதொழில்', en: 'Self-employed' },
  student: { ta: 'மாணவர்', en: 'Student' },
  homemaker: { ta: 'வீட்டுப் பராமரிப்பு', en: 'Home duties' },
  retired: { ta: 'ஓய்வுபெற்றவர்', en: 'Retired' },
  unemployed: { ta: 'வேலை தேடுபவர்', en: 'Looking for work' },
  other: { ta: 'பிற', en: 'Other' },
};

const PLACE_LEVELS: Record<string, Bilingual> = {
  district: { ta: 'மாவட்டம்', en: 'District' },
  ds: { ta: 'பிரதேச செயலகப் பிரிவு', en: 'DS division' },
  gn: { ta: 'கிராம சேவகர் பிரிவு', en: 'GN division' },
};

type Props = {
  data: StaffHouseholdView;
  locale: Locale;
};

function label(map: Record<string, Bilingual>, key: string | null | undefined, locale: Locale): string {
  if (!key) return '—';
  return map[key]?.[locale] ?? key;
}

/** Age band and occupation for an adult (each set their own), or the birth year for a child. */
function details(member: HouseholdMember, locale: Locale): string {
  if (member.role === 'dependent') {
    return member.birthYear ? `${locale === 'ta' ? 'பிறப்பு' : 'Born'} ${member.birthYear}` : '—';
  }
  const parts = [
    member.ageBand ? label(AGE_BAND_LABELS, member.ageBand, locale) : null,
    member.occupationCategory ? label(OCCUPATION_LABELS, member.occupationCategory, locale) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/**
 * Screen D02: Member and household record, read-only (SC-22, PRM-33, MP-FEA-002 §4.1).
 * Shown only within the staff member's area and only after the household gave caseworker consent;
 * every opening is recorded in the household's own history and in the audit log.
 */
export function HouseholdDetailView({ data, locale }: Props) {
  const { targetMemberCode, targetMemberName, household } = data;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-line bg-surface p-4 text-sm" aria-label="Privacy notice">
        <div className="flex flex-col gap-1">
          <span lang={locale} className="font-semibold text-text">
            {locale === 'ta' ? 'குடும்பத்தின் ஒப்புதலுடன் மட்டுமே திறக்கப்படும் பதிவு' : 'Opened only with the household’s consent'}
          </span>
          <p lang={locale} className="text-muted text-xs leading-relaxed">
            {locale === 'ta'
              ? 'இக்குடும்பம் சமூகப் பணியாளர் அணுகலை அனுமதித்துள்ளது. இத்தகவல்கள் உதவிப் பணிக்கு மட்டுமே; அரசியல், பிரசார அல்லது நிதி சேகரிப்புப் பணிகளுக்கு ஒருபோதும் பயன்படுத்தக்கூடாது. இத்திறப்பு குடும்பத்தின் வரலாற்றிலும் தணிக்கைப் பதிவிலும் பதியப்படுகிறது. குடும்பம் தன் பதிவுகளைச் செயலியில் தானே திருத்துகிறது; இங்கு மாற்றங்கள் செய்ய முடியாது.'
              : 'This household has allowed caseworker access. Use this information for casework only, never for political, campaign or fundraising work. This opening is recorded in the household’s own history and the audit log. The household corrects its own records in the app; nothing can be changed here.'}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-card p-4 text-sm shadow-sm" aria-label="Member overview">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span lang={locale} className="block text-xs font-semibold text-muted">
              {locale === 'ta' ? 'உறுப்பினர் பெயர் & எண்' : 'Member'}
            </span>
            <p className="mt-1 text-base font-bold text-text">
              {targetMemberName}{' '}
              <span className="font-mono text-sm font-normal text-muted">({targetMemberCode})</span>
            </p>
          </div>
          <div>
            <span lang={locale} className="block text-xs font-semibold text-muted">
              {locale === 'ta' ? 'குடும்ப இலக்கம்' : 'Household ID'}
            </span>
            <p className="mt-1 font-mono text-sm text-text">{household.householdCode}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-card p-4 text-sm shadow-sm" aria-label="Household information">
        <h2 className="text-base font-bold text-text mb-3">
          <span lang={locale}>{household.name || (locale === 'ta' ? 'பெயரிடப்படாத குடும்பம்' : 'Unnamed household')}</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {household.places.map((place) => (
            <div key={place.level} className="rounded-lg border border-line bg-surface p-3">
              <span lang={locale} className="block font-semibold text-muted">
                {label(PLACE_LEVELS, place.level, locale)}
              </span>
              <p className="mt-1 text-text font-medium">
                {(locale === 'ta' ? place.nameTa : place.nameEn) ?? place.nameEn ?? place.code}
              </p>
            </div>
          ))}
          <div className="rounded-lg border border-line bg-surface p-3">
            <span lang={locale} className="block font-semibold text-muted">
              {locale === 'ta' ? 'பதிவு செய்யப்பட்ட திகதி' : 'Created on'}
            </span>
            <p className="mt-1 text-text font-medium">{formatDate(household.createdAt)}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface p-3">
            <span lang={locale} className="block font-semibold text-muted">
              {locale === 'ta' ? 'சமூகப் பணியாளர் அணுகல் அனுமதிக்கப்பட்டது' : 'Caseworker access allowed on'}
            </span>
            <p className="mt-1 text-text font-medium">{formatDateTime(household.caseworkerConsentAt)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-card p-4 text-sm shadow-sm" aria-label="Members list">
        <h2 className="text-base font-bold text-text mb-3">
          <span lang={locale}>
            {locale === 'ta' ? 'குடும்ப உறுப்பினர்கள்' : 'Household members'} ({household.members.length})
          </span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-muted">
                <th className="pb-2">{locale === 'ta' ? 'பெயர்' : 'Name'}</th>
                <th className="pb-2">{locale === 'ta' ? 'பொறுப்பு' : 'Role'}</th>
                <th className="pb-2">{locale === 'ta' ? 'உறவுமுறை' : 'Relationship'}</th>
                <th className="pb-2">{locale === 'ta' ? 'விவரங்கள்' : 'Details'}</th>
                <th className="pb-2">{locale === 'ta' ? 'உறுப்பினர் எண்' : 'Member ID'}</th>
                <th className="pb-2">{locale === 'ta' ? 'இணைந்த திகதி' : 'Joined'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {household.members.map((member) => (
                <tr key={member.id} className="text-text hover:bg-surface/50">
                  <td className="py-2.5 font-medium">{member.displayName}</td>
                  <td className="py-2.5">
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold bg-surface text-text">
                      {label(ROLE_LABELS, member.role, locale)}
                    </span>
                  </td>
                  <td className="py-2.5 text-muted">{label(RELATIONSHIP_LABELS, member.relationship, locale)}</td>
                  <td className="py-2.5 text-xs text-muted">{details(member, locale)}</td>
                  <td className="py-2.5 font-mono text-xs">
                    {member.memberCode ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="py-2.5 text-xs text-muted">{formatDate(member.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
