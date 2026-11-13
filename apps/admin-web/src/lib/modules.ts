export type AdminModule = {
  href: string;
  ta: string;
  en: string;
  permission: string | readonly string[];
};

/** The dashboard's working modules and the permission each needs (the API checks again on every call). */
export const builtModules: readonly AdminModule[] = [
  { href: '/verification', ta: 'அடையாளச் சரிபார்ப்பு', en: 'Verification queue', permission: 'members.verify' },
  { href: '/appeals', ta: 'மேன்முறையீடுகள்', en: 'Verification appeals', permission: 'idv.appeal.decide' },
  { href: '/duplicates', ta: 'இரட்டைக் கணக்குகள்', en: 'Duplicate investigations', permission: 'idv.duplicate.investigate' },
  { href: '/membership', ta: 'உறுப்புரிமை', en: 'Membership activation', permission: 'members.activate' },
  { href: '/events', ta: 'நிகழ்வுகள்', en: 'Event console', permission: 'events.manage' },
  { href: '/volunteer-assignments', ta: 'தன்னார்வப் பணிகள்', en: 'Volunteer assignments', permission: 'volunteers.manage' },
  { href: '/volunteering', ta: 'தன்னார்வ வாய்ப்புகள்', en: 'Volunteering opportunities', permission: 'volunteers.manage' },
  { href: '/moderation', ta: 'நடுவர் வரிசை', en: 'Moderation queue', permission: 'content.moderate' },
  {
    href: '/development',
    ta: 'அபிவிருத்தி முன்மொழிவுகள்',
    en: 'Development proposals',
    permission: ['content.moderate', 'dev.review', 'dev.approve_planning'] as const,
  },
  { href: '/surveys', ta: 'கருத்துக்கணிப்புகள்', en: 'Surveys', permission: 'surveys.manage' },
  { href: '/learning', ta: 'கற்றல் பாடநெறிகள்', en: 'Learning courses', permission: 'content.moderate' },
  { href: '/gallery', ta: 'புகைப்படங்கள் & நீக்கங்கள்', en: 'Gallery console', permission: ['gallery.publish', 'gallery.takedown'] as const },
  { href: '/messages', ta: 'அறிவித்தல்கள் & செய்திகள்', en: 'Messaging composer', permission: 'notifications.send' },
  { href: '/policy-decisions', ta: 'கொள்கை முடிவுகள்', en: 'Policy decisions', permission: 'system.configure' },
  { href: '/finance-readiness', ta: 'நிதி தயார்நிலை', en: 'Finance production readiness', permission: 'system.configure' },
  { href: '/operations-governance', ta: 'செயல்பாடுகளும் நிர்வாகமும்', en: 'Operations and governance', permission: 'system.configure' },
  { href: '/settings', ta: 'கணினி அமைப்புகள்', en: 'Settings & registry', permission: 'system.configure' },
  { href: '/access', ta: 'பொறுப்புகளும் அனுமதிகளும்', en: 'Roles and access', permission: 'roles.assign' },
  { href: '/audit', ta: 'தணிக்கைப் பதிவு', en: 'Audit log', permission: 'audit.view' },
  { href: '/access-reviews', ta: 'அணுகல் மீளாய்வு', en: 'Access reviews', permission: 'audit.view' },
  { href: '/reports', ta: 'சமூகப் புகார்கள்', en: 'Community reports', permission: 'reports.view' },
  {
    href: '/cases',
    ta: 'சமூக விவகாரங்கள்',
    en: 'Community cases',
    permission: [
      'cases.collect',
      'cases.research',
      'cases.decide_district',
      'cases.plan_regional',
      'cases.approve_executive',
      'cases.implement_and_close',
      'content.moderate',
    ] as const,
  },
  { href: '/members', ta: 'உறுப்பினர்களும் குடும்பங்களும்', en: 'Members and households', permission: 'household.view_for_case' },
  { href: '/elections', ta: 'தேர்தல் பயன்முறை', en: 'Election mode', permission: 'election.mode.manage' },
  { href: '/privacy', ta: 'தனியுரிமைக் கோரிக்கைகள்', en: 'Privacy requests', permission: 'privacy.requests.handle' },
  { href: '/analytics', ta: 'பகுப்பாய்வு', en: 'Analytics', permission: 'analytics.view' },
  {
    href: '/finance',
    ta: 'கட்சி நிதி மற்றும் வங்கிச் சீட்டுகள்',
    en: 'Finance queue & slips',
    permission: ['finance.review', 'finance.approve', 'finance.export', 'finance.audit_read'] as const,
  },
] as const;

/** Planned modules in later phases with user-facing bilingual labels. */
export const plannedModules = [
  { name: 'Assistance case management', ta: 'உதவி விவகார மேலாண்மை', desc: 'Welfare and emergency assistance cases' },
  { name: 'Promise tracker and scorecards', ta: 'வாக்குறுதி கண்காணிப்பு', desc: 'Commitments and accountability scorecards' },
  { name: 'Town halls and participatory budgeting', ta: 'மக்கள் மன்றம் & வரவுசெலவுத் திட்டம்', desc: 'Deliberation and community voting' },
  { name: 'Official publishing and signing', ta: 'அதிகாரப்பூர்வ வெளியீடு', desc: 'Official gazette and signed notices' },
  { name: 'Committees and wings', ta: 'குழுக்களும் பிரிவுகளும்', desc: 'Youth, women, and diaspora wings' },
  { name: 'AI monitoring and further reports', ta: 'அறிக்கைகளும் அவதானிப்பும்', desc: 'Model safety (D21) and dashboards beyond the Phase 1 figures' },
] as const;
