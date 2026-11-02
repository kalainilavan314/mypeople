export type AdminModule = {
  href: string;
  ta: string;
  en: string;
  brd: string;
  permission: string | readonly string[];
};

/** The dashboard's working modules and the permission each needs (the API checks again on every call). */
export const builtModules: readonly AdminModule[] = [
  { href: '/verification', ta: 'அடையாளச் சரிபார்ப்பு', en: 'Verification queue', brd: 'W01, W02, D03', permission: 'members.verify' },
  { href: '/appeals', ta: 'மேன்முறையீடுகள்', en: 'Verification appeals', brd: 'D05', permission: 'idv.appeal.decide' },
  { href: '/duplicates', ta: 'இரட்டைக் கணக்குகள்', en: 'Duplicate investigations', brd: 'D04', permission: 'idv.duplicate.investigate' },
  { href: '/membership', ta: 'உறுப்புரிமை', en: 'Membership activation', brd: 'D06', permission: 'members.activate' },
  { href: '/events', ta: 'நிகழ்வுகள்', en: 'Event console', brd: 'D07, GAP-03', permission: 'events.manage' },
  { href: '/gallery', ta: 'புகைப்படங்கள் & நீக்கங்கள்', en: 'Gallery console', brd: 'D08, GAP-04', permission: ['gallery.publish', 'gallery.takedown'] as const },
  { href: '/messages', ta: 'அறிவித்தல்கள் & செய்திகள்', en: 'Messaging composer', brd: 'D09, GAP-05', permission: 'notifications.send' },
  { href: '/settings', ta: 'கணினி அமைப்புகள்', en: 'Settings & registry', brd: 'D34', permission: 'system.configure' },
  { href: '/access', ta: 'பொறுப்புகளும் அனுமதிகளும்', en: 'Roles and access', brd: 'W09', permission: 'roles.assign' },
  { href: '/audit', ta: 'தணிக்கைப் பதிவு', en: 'Audit log', brd: 'FR-ADM-011', permission: 'audit.view' },
  { href: '/access-reviews', ta: 'அணுகல் மீளாய்வு', en: 'Access reviews', brd: 'D31', permission: 'audit.view' },
] as const;

/** The dashboard's modules from BRD v1.1 §15A.6 that are not built yet. */
export const plannedModules = [
  { name: 'Members and households', brd: '§11.14, §11.20 · D02' },
  { name: 'Community cases', brd: '§11.4 · W03–W08' },
  { name: 'Assistance case management', brd: '§11.21 · D13, D14' },
  { name: 'Finance and reconciliation', brd: '§11.9, §11.41 · D10, D11' },
  { name: 'Promise tracker and scorecards', brd: '§11.23, §11.24 · D16, D17' },
  { name: 'Town halls and participatory budgeting', brd: '§11.11, §11.25, §11.26 · D18, D19' },
  { name: 'Official publishing and signing', brd: '§11.13, §11.40 · D30' },
  { name: 'Committees and wings', brd: '§11.29 · D23' },
  { name: 'Election mode', brd: '§11.28, §16.5 · D22' },
  { name: 'Reports and AI monitoring', brd: '§11.16, §15B.5, §17 · D20, D21, D32' },
] as const;
