import { ApiError } from '@my-people/api-client';

// What staff read when the API refuses or fails. Codes come from the API
// (docs/api/api-reference.md); a code with no words here is shown as itself,
// so a reviewer can still report it.
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'The ID number or password is not correct.',
  too_many_attempts: 'Too many attempts. Wait and try again.',
  invalid_code: 'The code is not correct. Use the newest code in your authenticator app.',
  mfa_locked: 'Too many wrong codes. Wait and try again.',
  forbidden: 'Your role does not include this.',
  outside_your_area: 'This record is outside your area.',
  own_record: 'You cannot act on your own record.',
  no_open_review: 'Claim the member’s identity review first.',
  claimed_by_another: 'Another reviewer holds this.',
  not_claimed_by_you: 'Claim it first.',
  not_open: 'This is no longer open.',
  original_reviewer: 'The reviewer who made the original decision cannot decide the appeal.',
  reported_by_you: 'You reported this case, so someone else investigates it.',
  target_outranks_you: 'This person holds a role at or above yours.',
  link_expired: 'The view link expired. Open the image again.',
  evidence_storage_not_configured: 'Identity images cannot be opened: the evidence store is not set up.',
  feature_unavailable: 'This module is not switched on yet.',
  not_found: 'Not found.',
  decision_refused: 'The decision is not complete.',
  change_refused: 'This change is not allowed.',
  assignment_refused: 'This assignment is not allowed.',
  own_assignment: 'You cannot review your own role.',
  tier_not_below_yours: 'You can review only roles below your own tier.',
  tier_5_by_bootstrap_only: 'The Super Administrator role is not reviewed here.',
  not_due: 'This role was already reviewed this quarter.',
  report_refused: 'The report is not complete.',
};

const PROBLEMS: Record<string, string> = {
  reason_required: 'Choose a reason.',
  items_required: 'Name what the member must correct.',
  items_only_for_request_update: 'Items are only for a request to update.',
  reason_only_for_refusals: 'A reason is only for a refusal.',
  self_assignment: 'You cannot assign a role to yourself.',
  identity_not_verified: 'The member’s identity is not verified yet.',
  note_required: 'Write a note when the reason is “other”.',
  tier_not_below_yours: 'You can assign only tiers below your own.',
  separation_of_duties: 'These permissions conflict with others the person holds (RB-12).',
  area_does_not_match_tier: 'The area level does not match the tier.',
  unknown_area: 'Unknown area code.',
  no_permissions: 'Choose at least one permission.',
};

export function problemText(problem: string): string {
  const [code, detail] = problem.split(':', 2);
  if (code === 'checklist_incomplete') return `Checklist item not confirmed: ${detail}.`;
  if (code === 'evidence_not_viewed') return `Open the ${detail?.replace('_', ' ')} image before approving.`;
  if (code === 'not_allowed_from') return `Not allowed while the state is ${detail?.replace(/_/g, ' ')}.`;
  if (code === 'permission_not_held' || code === 'permission_not_for_tier' || code === 'unknown_permission') {
    return `${code.replace(/_/g, ' ')}: ${detail}`;
  }
  return PROBLEMS[code] ?? problem.replace(/_/g, ' ');
}

export function messageFor(code: string): string {
  return MESSAGES[code] ?? code.replace(/_/g, ' ');
}

/** The error code and problems to carry back to the page after a refused action. */
export function failure(error: unknown): { code: string; problems: string[] } {
  if (error instanceof ApiError) return { code: error.code, problems: error.problems };
  return { code: 'unavailable', problems: [] };
}
