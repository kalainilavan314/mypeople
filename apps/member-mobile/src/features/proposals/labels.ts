import type { ProposalCategory, ProposalStage } from '@my-people/api-client';
import type { Tone } from '@my-people/mobile-ui';

/** The 13 categories (BRD M16), in the order the form lists them; words are m.proposals.category_<key>. */
export const PROPOSAL_CATEGORIES: readonly ProposalCategory[] = [
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

/** The stage pill's colour; the words are My Activity's (m.profile.activityState_proposal_*). */
export const STAGE_TONES: Record<ProposalStage, Tone> = {
  pending_moderation: 'pending',
  rejected: 'error',
  review: 'pending',
  approved_for_planning: 'verified',
  funding_identified: 'verified',
  implementation: 'verified',
  not_taken_forward: 'neutral',
  withdrawn: 'neutral',
};

/** Stages the author may withdraw from (the API's AUTHOR_MAY_WITHDRAW). */
export const WITHDRAWABLE: readonly ProposalStage[] = ['pending_moderation', 'rejected', 'review'];

/** The limits the API enforces (ProposalIn), checked here first. */
export const LIMITS = {
  titleMin: 5,
  titleMax: 120,
  problemMin: 20,
  problemMax: 3000,
  solutionMin: 20,
  solutionMax: 3000,
  benefitMin: 10,
  benefitMax: 2000,
  evidenceMax: 2000,
  /** Up to Rs. 999,999,999,999. */
  costDigits: 12,
} as const;

/** "Rs. 1,250,000" in the member's language; the API stores rupees as a decimal. */
export function rupees(amount: string | number, language: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  return `Rs. ${value.toLocaleString(language === 'ta' ? 'ta-LK' : 'en-LK', { maximumFractionDigits: 2 })}`;
}
