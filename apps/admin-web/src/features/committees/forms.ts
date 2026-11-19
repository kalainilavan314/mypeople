import type {
  CommitteeKind,
  CommitteeProposalInput,
  CommitteeRole,
  CommitteeState,
  CommitteeWingType,
} from '@my-people/api-client';

import { text, uuidOrNull, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the committees API uses, and the one the dashboard's own checks use too. */
export const COMMITTEE_REFUSED = 'committee_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };

export const WING_TYPES: readonly CommitteeWingType[] = ['youth', 'women', 'farmers', 'fishers', 'professional', 'diaspora'];
export const WING_LABELS: Readonly<Record<CommitteeWingType, Words>> = {
  youth: { ta: 'இளைஞர் அணி', en: 'Youth wing' },
  women: { ta: 'மகளிர் அணி', en: "Women's wing" },
  farmers: { ta: 'விவசாயிகள் அணி', en: "Farmers' wing" },
  fishers: { ta: 'கடற்றொழிலாளர் அணி', en: "Fishers' wing" },
  professional: { ta: 'தொழில்வல்லுநர் அணி', en: 'Professionals’ wing' },
  diaspora: { ta: 'புலம்பெயர் தமிழர் அணி', en: 'Tamils abroad wing' },
};

export const KIND_LABELS: Readonly<Record<CommitteeKind, Words>> = {
  wing: { ta: 'அணி', en: 'Wing' },
  committee: { ta: 'குழு', en: 'Committee' },
};

export const STATES: readonly CommitteeState[] = ['proposed', 'active', 'rejected', 'closed'];
export const STATE_LABELS: Readonly<Record<CommitteeState, Words>> = {
  proposed: { ta: 'Tier 5 அங்கீகாரத்துக்குக் காத்திருக்கிறது', en: 'Waiting for Tier 5 approval' },
  active: { ta: 'செயலில் உள்ளது', en: 'Active' },
  rejected: { ta: 'நிராகரிக்கப்பட்டது', en: 'Rejected' },
  closed: { ta: 'மூடப்பட்டது', en: 'Closed' },
};
export const STATE_TONES: Readonly<Record<CommitteeState, 'waiting' | 'done' | 'refused' | 'neutral'>> = {
  proposed: 'waiting',
  active: 'done',
  rejected: 'refused',
  closed: 'neutral',
};

export const ROLES: readonly CommitteeRole[] = ['coordinator', 'secretary', 'member'];
export const ROLE_LABELS: Readonly<Record<CommitteeRole, Words>> = {
  coordinator: { ta: 'ஒருங்கிணைப்பாளர்', en: 'Coordinator' },
  secretary: { ta: 'செயலாளர்', en: 'Secretary' },
  member: { ta: 'உறுப்பினர்', en: 'Member' },
};

/** FR-COM-009, RPT-23: the activity counts, in the order the report shows them. */
export const ACTIVITY_LABELS: readonly (readonly [string, Words])[] = [
  ['members', { ta: 'உறுப்பினர்கள்', en: 'Members' }],
  ['coordinators', { ta: 'ஒருங்கிணைப்பாளர்கள்', en: 'Coordinators' }],
  ['secretaries', { ta: 'செயலாளர்கள்', en: 'Secretaries' }],
  ['applicationsWaiting', { ta: 'காத்திருக்கும் விண்ணப்பங்கள்', en: 'Applications waiting' }],
  ['joinedRecently', { ta: 'சேர்ந்தோர்', en: 'Joined' }],
  ['leftRecently', { ta: 'விலகியோர் / நீக்கப்பட்டோர்', en: 'Left or removed' }],
  ['announcements', { ta: 'அறிவிப்புகள்', en: 'Announcements' }],
  ['meetingsHeld', { ta: 'நடைபெற்ற கூட்டங்கள்', en: 'Meetings held' }],
  ['meetingsPlanned', { ta: 'திட்டமிடப்பட்ட கூட்டங்கள்', en: 'Meetings planned' }],
  ['minutesApproved', { ta: 'அங்கீகரிக்கப்பட்ட கூட்டக் குறிப்புகள்', en: 'Minutes approved' }],
  ['minutesWaiting', { ta: 'காத்திருக்கும் கூட்டக் குறிப்புகள்', en: 'Minutes waiting' }],
  ['tasksOpen', { ta: 'நிலுவையிலுள்ள பணிகள்', en: 'Tasks open' }],
  ['tasksOverdue', { ta: 'தவணை கடந்த பணிகள்', en: 'Tasks overdue' }],
  ['tasksDone', { ta: 'முடிந்த பணிகள்', en: 'Tasks done' }],
  ['volunteerSignups', { ta: 'தன்னார்வ முன்வருகைகள்', en: 'Volunteer offers' }],
  ['documents', { ta: 'ஆவணங்கள்', en: 'Documents' }],
  ['threads', { ta: 'கலந்துரையாடல்கள்', en: 'Discussions' }],
  ['replies', { ta: 'பதில்கள்', en: 'Replies' }],
  ['discussionWaiting', { ta: 'காத்திருக்கும் பதிவுகள்', en: 'Posts waiting' }],
];

export const PROPOSAL_TEXT_FIELDS = [
  'kind', 'wingType', 'wingId', 'nameTa', 'nameEn', 'purposeTa', 'purposeEn', 'area', 'areaOther',
] as const;

export const COMMITTEE_TARGETS: ProblemTargets = {
  committee_kind_required: 'kind',
  wing_type_required: 'wingType',
  wing_required: 'wingId',
  wing_not_active: 'wingId',
  wing_type_mismatch: 'wingType',
  outside_wing_area: 'area',
  name_required: 'nameTa',
  committee_purpose_required: 'purposeTa',
  area_required: 'area',
  unknown_area: 'area',
  reason_required: 'reason',
  decision_required: 'decision',
  member_code_required: 'memberCode',
  unknown_member: 'memberCode',
  identity_not_verified: 'memberCode',
  membership_not_active: 'memberCode',
  already_has_role: 'role',
  committee_role_required: 'role',
  last_coordinator: 'role',
};

type Area = CommitteeProposalInput['area'];

/** "platform", or "level:code" for a province, district, DS division or GN division. */
export function readCommitteeArea(value: string): Area | null {
  if (value === 'platform') return { level: 'platform', code: null };
  const [level, code] = value.split(':', 2);
  if (level !== 'province' && level !== 'district' && level !== 'ds' && level !== 'gn') return null;
  const trimmed = (code ?? '').trim();
  return trimmed.length >= 2 && trimmed.length <= 20 ? { level, code: trimmed } : null;
}

/**
 * FR-COM-001: a wing, or a committee inside an approved wing of the same type, with its name and
 * purpose in Tamil and English and its area. It is only proposed: a Tier 5 approves it.
 */
export function readProposal(form: FormLike): Read<CommitteeProposalInput> {
  const t = (name: string) => text(form, name);
  const kind = (['wing', 'committee'] as const).find((value) => value === t('kind'));
  const wingType = WING_TYPES.find((value) => value === t('wingType'));
  const wingId = uuidOrNull(form, 'wingId');
  const area = readCommitteeArea(t('area') === 'other' ? t('areaOther') : t('area'));
  const both = (name: string, min: number) => t(`${name}Ta`).length >= min && t(`${name}En`).length >= min;
  const problems = [
    ...(kind ? [] : ['committee_kind_required']),
    ...(wingType ? [] : ['wing_type_required']),
    ...(kind === 'committee' && !wingId ? ['wing_required'] : []),
    ...(both('name', 3) ? [] : ['name_required']),
    ...(both('purpose', 10) ? [] : ['committee_purpose_required']),
    ...(area ? [] : ['area_required']),
  ];
  if (problems.length > 0 || !kind || !wingType || !area) return { input: null, problems };
  return {
    input: {
      kind,
      wingType,
      wingId: kind === 'committee' ? wingId : null,
      nameTa: t('nameTa'),
      nameEn: t('nameEn'),
      purposeTa: t('purposeTa'),
      purposeEn: t('purposeEn'),
      area,
    },
    problems,
  };
}

/** Approve, or reject with the reason (a reason is required to reject). */
export function readCommitteeDecision(form: FormLike): Read<{ approve: boolean; reason: string | null }> {
  const decision = text(form, 'decision');
  const reason = text(form, 'reason');
  if (decision !== 'approve' && decision !== 'reject') return { input: null, problems: ['decision_required'] };
  if (decision === 'reject' && reason.length < 3) return { input: null, problems: ['reason_required'] };
  return { input: { approve: decision === 'approve', reason: reason || null }, problems: [] };
}

/** FR-COM-003: a role given by member code, as an explicit grant logged with the administrator. */
export function readRoleGrant(form: FormLike): Read<{ memberCode: string; role: CommitteeRole }> {
  const memberCode = text(form, 'memberCode');
  const role = ROLES.find((value) => value === text(form, 'role'));
  const problems = [...(memberCode.length >= 3 ? [] : ['member_code_required']), ...(role ? [] : ['committee_role_required'])];
  if (problems.length > 0 || !role) return { input: null, problems };
  return { input: { memberCode, role }, problems };
}
