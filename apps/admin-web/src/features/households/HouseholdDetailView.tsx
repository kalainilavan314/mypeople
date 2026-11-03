import type { StaffHouseholdView } from '@my-people/api-client';

import { StateTag } from '@/components/StateTag';
import { formatDateTime } from '@/lib/format';
import type { Locale } from '@/lib/i18n/types';

const ROLE_LABELS: Record<string, { ta: string; en: string }> = {
  head: { ta: 'குடும்பத் தலைவர்', en: 'Head of Household' },
  adult: { ta: 'வயதுவந்த உறுப்பினர்', en: 'Adult Member' },
};

const RELATIONSHIP_LABELS: Record<string, { ta: string; en: string }> = {
  head: { ta: 'குடும்பத் தலைவர்', en: 'Head of Household' },
  spouse: { ta: 'வாழ்க்கைத் துணை', en: 'Spouse' },
  parent: { ta: 'பெற்றோர்', en: 'Parent' },
  sibling: { ta: 'உடன்பிறப்பு', en: 'Sibling' },
  other: { ta: 'பிற உறவினர்', en: 'Other Relative' },
};

const ACTION_LABELS: Record<string, { ta: string; en: string }> = {
  create: { ta: 'குடும்பம் உருவாக்கப்பட்டது', en: 'Created household' },
  join: { ta: 'உறுப்பினர் இணைந்தார்', en: 'Joined household' },
  invite_adult: { ta: 'வயதுவந்தவருக்கு அழைப்பு அனுப்பப்பட்டது', en: 'Invited adult member' },
  leave_household: { ta: 'குடும்பத்திலிருந்து விலகினார்', en: 'Left household' },
  remove_member: { ta: 'உறுப்பினர் நீக்கப்பட்டார்', en: 'Removed member' },
  dissolve_household: { ta: 'குடும்பம் கலைக்கப்பட்டது', en: 'Dissolved household' },
  staff_view: { ta: 'அதிகாரியின் விவகாரப் பார்வை (PRM-33)', en: 'Staff case view (PRM-33)' },
};

type Props = {
  data: StaffHouseholdView;
  locale: Locale;
};

/**
 * Screen D02: Member and household administration detail view (SC-22, PRM-33).
 * Read-only operational view under permitted geographic scope.
 */
export function HouseholdDetailView({ data, locale }: Props) {
  const { targetMemberCode, targetMemberName, household, consentLogs } = data;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-line bg-surface p-4 text-sm" aria-label="Privacy notice">
        <div className="flex flex-col gap-1">
          <span lang={locale} className="font-semibold text-text">
            {locale === 'ta'
              ? 'விருப்பத்தின் அடிப்படையிலான குடும்பத் தொகுதி'
              : 'Voluntary household information'}
          </span>
          <p lang={locale} className="text-muted text-xs leading-relaxed">
            {locale === 'ta'
              ? 'குடும்பத் தகவல்கள் தொடர்பற்ற பதிவுகளிலிருந்து தனியாக வைக்கப்படுகின்றன. உங்கள் அனுமதிக்கப்பட்ட ஆளுகைப் பரப்பில் மட்டுமே இப்பார்வை இயலும்.'
              : 'Household information is kept separate from unrelated records. This view is available only within your permitted area.'}
          </p>
        </div>
      </section>

      {/* Target Member Overview Card */}
      <section className="rounded-xl border border-line bg-card p-4 text-sm shadow-sm" aria-label="Member overview">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span lang={locale} className="block text-xs font-semibold text-muted">
              {locale === 'ta' ? 'உறுப்பினர் பெயர் & எண்' : 'Target member'}
            </span>
            <p className="mt-1 text-base font-bold text-text">
              {targetMemberName}{' '}
              <span className="font-mono text-sm font-normal text-muted">({targetMemberCode})</span>
            </p>
          </div>
          <div>
            <span lang={locale} className="block text-xs font-semibold text-muted">
              {locale === 'ta' ? 'குடும்ப நிலை' : 'Household status'}
            </span>
            <div className="mt-1">
              <StateTag state={household ? 'active' : 'inactive'} />
            </div>
          </div>
        </div>
      </section>

      {/* Household Records or Empty State */}
      {!household ? (
        <section className="rounded-xl border border-dashed border-line bg-card p-8 text-center text-sm" aria-label="No household">
          <p lang={locale} className="text-base font-semibold text-text">
            {locale === 'ta' ? 'குடும்பப் பதிவுகள் எதுவும் இல்லை' : 'No Active Household'}
          </p>
          <p lang={locale} className="mt-2 text-muted max-w-md mx-auto text-xs leading-relaxed">
            {locale === 'ta'
              ? 'இந்த உறுப்பினர் தற்போது எந்தவொரு குடும்பக் குழுவிலும் இணையவில்லை. குடும்பப் பகிர்வு முற்றிலும் சுயவிருப்பத்தின் அடிப்படையிலானது.'
              : 'This member has not registered or joined any active household. Household participation is entirely voluntary.'}
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Household Metadata Card */}
          <section className="rounded-xl border border-line bg-card p-4 text-sm shadow-sm" aria-label="Household information">
            <h2 className="text-base font-bold text-text mb-3">
              <span lang={locale}>
                {household.name || (locale === 'ta' ? 'பெயரிடப்படாத குடும்பம்' : 'Unnamed Household')}
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-line bg-surface p-3">
                <span lang={locale} className="block font-semibold text-muted">
                  {locale === 'ta' ? 'பதிவு செய்யப்பட்ட திகதி' : 'Created on'}
                </span>
                <p className="mt-1 text-text font-medium">{formatDateTime(household.createdAt)}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3">
                <span lang={locale} className="block font-semibold text-muted">
                  {locale === 'ta' ? 'மொத்த உறுப்பினர்கள்' : 'Active members'}
                </span>
                <p className="mt-1 text-text font-medium">{household.members.length}</p>
              </div>
            </div>
          </section>

          {/* Members Table */}
          <section className="rounded-xl border border-line bg-card p-4 text-sm shadow-sm" aria-label="Members list">
            <h2 className="text-base font-bold text-text mb-3">
              <span lang={locale}>
                {locale === 'ta' ? 'குடும்ப உறுப்பினர்கள்' : 'Household Members'} ({household.members.length})
              </span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold text-muted">
                    <th className="pb-2">{locale === 'ta' ? 'பெயர்' : 'Display name'}</th>
                    <th className="pb-2">{locale === 'ta' ? 'பொறுப்பு' : 'Role'}</th>
                    <th className="pb-2">{locale === 'ta' ? 'உறவுமுறை' : 'Relationship'}</th>
                    <th className="pb-2">{locale === 'ta' ? 'உறுப்பினர் எண்' : 'Member ID'}</th>
                    <th className="pb-2">{locale === 'ta' ? 'இணைந்த திகதி' : 'Joined date'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {household.members.map((member) => (
                    <tr key={member.id} className="text-text hover:bg-surface/50">
                      <td className="py-2.5 font-medium">{member.displayName}</td>
                      <td className="py-2.5">
                        <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold bg-surface text-text">
                          {ROLE_LABELS[member.role]?.[locale] ?? member.role}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted">
                        {RELATIONSHIP_LABELS[member.relationship]?.[locale] ?? member.relationship}
                      </td>
                      <td className="py-2.5 font-mono text-xs">
                        {member.memberCode ?? <span className="text-muted">—</span>}
                      </td>
                      <td className="py-2.5 text-xs text-muted">{formatDateTime(member.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Consent and Activity Audit Trail */}
          <section className="rounded-xl border border-line bg-card p-4 text-sm shadow-sm" aria-label="Consent history">
            <h2 className="text-base font-bold text-text mb-3">
              <span lang={locale}>
                {locale === 'ta' ? 'ஒப்புதல் மற்றும் நடவடிக்கை வரலாறு' : 'Consent & Activity History'}
              </span>
            </h2>
            {consentLogs.length === 0 ? (
              <p lang={locale} className="text-xs text-muted">
                {locale === 'ta' ? 'பதிவுகள் எதுவும் இல்லை.' : 'No audit history recorded yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line text-xs font-semibold text-muted">
                      <th className="pb-2">{locale === 'ta' ? 'நடவடிக்கை' : 'Action'}</th>
                      <th className="pb-2">{locale === 'ta' ? 'செய்தவர்' : 'Actor'}</th>
                      <th className="pb-2">{locale === 'ta' ? 'திகதி & நேரம்' : 'Timestamp'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {consentLogs.map((log) => (
                      <tr key={log.id} className="text-text hover:bg-surface/50">
                        <td className="py-2.5">
                          <span className="font-medium">
                            {ACTION_LABELS[log.action]?.[locale] ?? log.action}
                          </span>
                        </td>
                        <td className="py-2.5 text-muted text-xs">
                          {log.actorName || <span className="font-mono">{log.actorId.slice(0, 8)}…</span>}
                        </td>
                        <td className="py-2.5 text-xs text-muted">{formatDateTime(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
