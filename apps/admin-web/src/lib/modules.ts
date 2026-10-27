/** The dashboard's working modules and the permission each needs (the API checks again on every call). */
export const builtModules = [
  { href: '/verification', ta: 'அடையாளச் சரிபார்ப்பு', en: 'Verification queue', brd: 'W01, W02, D03', permission: 'members.verify' },
  { href: '/appeals', ta: 'மேன்முறையீடுகள்', en: 'Verification appeals', brd: 'D05', permission: 'idv.appeal.decide' },
  { href: '/duplicates', ta: 'இரட்டைக் கணக்குகள்', en: 'Duplicate investigations', brd: 'D04', permission: 'idv.duplicate.investigate' },
  { href: '/membership', ta: 'உறுப்புரிமை', en: 'Membership activation', brd: 'D06', permission: 'members.activate' },
  { href: '/access', ta: 'பொறுப்புகளும் அனுமதிகளும்', en: 'Roles and access', brd: 'W09', permission: 'roles.assign' },
  { href: '/audit', ta: 'தணிக்கைப் பதிவு', en: 'Audit log', brd: 'FR-ADM-011', permission: 'audit.view' },
] as const;

/** The dashboard's modules from BRD v1.1 §15A.6 that are not built yet. */
export const plannedModules = [
  { name: 'Members and households', brd: '§11.14, §11.20' },
  { name: 'Community cases', brd: '§11.4 · W03–W08' },
  { name: 'Assistance case management', brd: '§11.21' },
  { name: 'Finance and reconciliation', brd: '§11.9, §11.41' },
  { name: 'Promise tracker and scorecards', brd: '§11.23, §11.24' },
  { name: 'Events, town halls and budgeting', brd: '§11.11, §11.25, §11.26' },
  { name: 'Content, moderation and signing', brd: '§11.13, §11.40' },
  { name: 'Committees', brd: '§11.29' },
  { name: 'Election mode', brd: '§11.28, §16.5' },
  { name: 'Reports and AI monitoring', brd: '§11.16, §15B.5, §17' },
] as const;
