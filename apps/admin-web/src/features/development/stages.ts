import type { ProposalCategory, ProposalMoveInput, ProposalStage } from '@my-people/api-client';

type Words = { ta: string; en: string };
export type MoveTarget = ProposalMoveInput['stage'];

export const PROPOSAL_STAGES: readonly ProposalStage[] = [
  'pending_moderation',
  'review',
  'approved_for_planning',
  'funding_identified',
  'implementation',
  'not_taken_forward',
  'rejected',
  'withdrawn',
];

export const STAGE_LABELS: Readonly<Record<ProposalStage, Words>> = {
  pending_moderation: { ta: 'நடுவர் பரிசீலனைக்காகக் காத்திருக்கிறது', en: 'Waiting for moderation' },
  rejected: { ta: 'நிராகரிக்கப்பட்டது', en: 'Rejected' },
  review: { ta: 'மீளாய்வில்', en: 'In review' },
  approved_for_planning: { ta: 'திட்டமிடலுக்கு அங்கீகரிக்கப்பட்டது', en: 'Approved for planning' },
  funding_identified: { ta: 'நிதி அடையாளம் காணப்பட்டது', en: 'Funding identified' },
  implementation: { ta: 'நடைமுறைப்படுத்தலில்', en: 'In implementation' },
  not_taken_forward: { ta: 'முன்னெடுக்கப்படவில்லை', en: 'Not taken forward' },
  withdrawn: { ta: 'ஆசிரியரால் மீளப்பெறப்பட்டது', en: 'Withdrawn by the author' },
};

export const STAGE_TONES: Readonly<Record<ProposalStage, 'waiting' | 'done' | 'refused' | 'neutral'>> = {
  pending_moderation: 'waiting',
  review: 'waiting',
  approved_for_planning: 'done',
  funding_identified: 'done',
  implementation: 'done',
  not_taken_forward: 'refused',
  rejected: 'refused',
  withdrawn: 'neutral',
};

export const CATEGORIES: readonly ProposalCategory[] = [
  'roads_transport',
  'agriculture',
  'fisheries',
  'employment',
  'education',
  'drinking_water',
  'healthcare',
  'environment',
  'waste_management',
  'tourism_enterprise',
  'digital_literacy',
  'youth_skills',
  'other',
];

export const CATEGORY_LABELS: Readonly<Record<ProposalCategory, Words>> = {
  roads_transport: { ta: 'வீதிகளும் போக்குவரத்தும்', en: 'Roads and transport' },
  agriculture: { ta: 'விவசாயம்', en: 'Agriculture' },
  fisheries: { ta: 'மீன்பிடி', en: 'Fisheries' },
  employment: { ta: 'வேலைவாய்ப்பு', en: 'Employment' },
  education: { ta: 'கல்வி', en: 'Education' },
  drinking_water: { ta: 'குடிநீர்', en: 'Drinking water' },
  healthcare: { ta: 'சுகாதாரம்', en: 'Healthcare' },
  environment: { ta: 'சுற்றுச்சூழல்', en: 'Environment' },
  waste_management: { ta: 'கழிவு முகாமைத்துவம்', en: 'Waste management' },
  tourism_enterprise: { ta: 'சுற்றுலாவும் தொழில்முயற்சியும்', en: 'Tourism and enterprise' },
  digital_literacy: { ta: 'டிஜிட்டல் எழுத்தறிவு', en: 'Digital literacy' },
  youth_skills: { ta: 'இளைஞர் திறன்கள்', en: 'Youth skills' },
  other: { ta: 'ஏனையவை', en: 'Other' },
};

export const MODERATE = 'content.moderate';
export const REVIEW = 'dev.review';
export const APPROVE = 'dev.approve_planning';
export const PROPOSAL_PERMISSIONS = [MODERATE, REVIEW, APPROVE] as const;

/** Who may record a step, in words: the API decides by the viewer's permission, tier and area. */
export const AUTHORITY: Readonly<Record<string, Words>> = {
  [MODERATE]: { ta: 'உள்ளடக்க நடுவர்கள்', en: 'Content moderators (content.moderate)' },
  [REVIEW]: { ta: 'நிலை 2A மற்றும் அதற்கு மேல், அபிவிருத்தி மீளாய்வு', en: 'Tier 2A and above with development review (dev.review)' },
  [APPROVE]: { ta: 'நிலை 3A மற்றும் அதற்கு மேல், திட்டமிடல் அங்கீகாரம்', en: 'Tier 3A and above with planning approval (dev.approve_planning)' },
};

export type Move = {
  to: MoveTarget;
  permission: string;
  /** The API needs a reason for this step; it is shown to members with the new stage (FR-DEV-007). */
  reasonRequired: boolean;
  label: Words;
  intro: string;
  tone: 'primary' | 'secondary' | 'danger';
};

/**
 * Every step the API allows from each stage (its MOVES table) and who records it. All are shown;
 * the API refuses the ones the viewer's tier cannot record. Popularity never moves a proposal.
 */
export const NEXT_MOVES: Readonly<Record<ProposalStage, readonly Move[]>> = {
  pending_moderation: [
    {
      to: 'review',
      permission: MODERATE,
      reasonRequired: false,
      label: { ta: 'மீளாய்வுக்கு வெளியிடவும்', en: 'Publish for review' },
      intro: 'Members in the area can read it once published. Check that it holds no names, phone numbers or personal details.',
      tone: 'primary',
    },
    {
      to: 'rejected',
      permission: MODERATE,
      reasonRequired: true,
      label: { ta: 'நிராகரிக்கவும்', en: 'Reject' },
      intro: 'The author is told with your reason and can revise and send it again.',
      tone: 'danger',
    },
  ],
  review: [
    {
      to: 'approved_for_planning',
      permission: APPROVE,
      reasonRequired: true,
      label: { ta: 'திட்டமிடலுக்கு அங்கீகரிக்கவும்', en: 'Approve for planning' },
      intro: 'Approval for planning never commits funds (BR-109). The reason is shown to members.',
      tone: 'primary',
    },
    {
      to: 'not_taken_forward',
      permission: REVIEW,
      reasonRequired: true,
      label: { ta: 'முன்னெடுக்கப்படவில்லை', en: 'Not taken forward' },
      intro: 'The reason is shown to members with the decision.',
      tone: 'danger',
    },
  ],
  approved_for_planning: [
    {
      to: 'funding_identified',
      permission: APPROVE,
      reasonRequired: true,
      label: { ta: 'நிதி அடையாளம் காணப்பட்டது', en: 'Funding identified' },
      intro: 'Say where the funding comes from; the reason is shown to members.',
      tone: 'primary',
    },
    {
      to: 'not_taken_forward',
      permission: APPROVE,
      reasonRequired: true,
      label: { ta: 'முன்னெடுக்கப்படவில்லை', en: 'Not taken forward' },
      intro: 'The reason is shown to members with the decision.',
      tone: 'danger',
    },
  ],
  funding_identified: [
    {
      to: 'implementation',
      permission: APPROVE,
      reasonRequired: false,
      label: { ta: 'நடைமுறைப்படுத்தலுக்கு நகர்த்தவும்', en: 'Move to implementation' },
      intro: 'A note is optional.',
      tone: 'primary',
    },
  ],
  implementation: [],
  not_taken_forward: [],
  rejected: [],
  withdrawn: [],
};

export function isProposalStage(value: string | undefined): value is ProposalStage {
  return (PROPOSAL_STAGES as readonly string[]).includes(value ?? '');
}

export function isCategory(value: string | undefined): value is ProposalCategory {
  return (CATEGORIES as readonly string[]).includes(value ?? '');
}

export function moveFor(stage: ProposalStage, to: string): Move | undefined {
  return NEXT_MOVES[stage].find((move) => move.to === to);
}
