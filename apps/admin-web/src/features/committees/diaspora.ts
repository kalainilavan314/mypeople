/** Names for the diaspora page's counts; the API sends codes only. */
export const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  CA: 'Canada',
  GB: 'United Kingdom',
  FR: 'France',
  CH: 'Switzerland',
  DE: 'Germany',
  NO: 'Norway',
  DK: 'Denmark',
  SE: 'Sweden',
  NL: 'Netherlands',
  IT: 'Italy',
  AU: 'Australia',
  NZ: 'New Zealand',
  US: 'United States',
  IN: 'India',
  MY: 'Malaysia',
  SG: 'Singapore',
  AE: 'United Arab Emirates',
  QA: 'Qatar',
  SA: 'Saudi Arabia',
  KW: 'Kuwait',
};

export const TOPIC_LABELS: Readonly<Record<string, string>> = {
  international_events: 'Events they can join from abroad',
  committee_networking: 'New diaspora committees',
};

export const PROPOSAL_STAGE_LABELS: Readonly<Record<string, string>> = {
  pending_moderation: 'Pending moderation',
  rejected: 'Needs changes',
  review: 'Under review',
  approved_for_planning: 'Approved for planning',
  funding_identified: 'Funding identified',
  implementation: 'In implementation',
  completed: 'Completed',
  not_taken_forward: 'Not taken forward',
  withdrawn: 'Withdrawn',
};

/** A count, or "fewer than 5" when the API hid it (null). */
export function countText(count: number | null): string {
  return count === null ? 'fewer than 5' : String(count);
}
