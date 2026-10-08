import type { ServerMember } from '../data/authApi';

/**
 * Pure display helpers for the signed-in member's identity on Home/Profile.
 * Never invent a name, member ID, or district — a missing value must render
 * as an honest placeholder (or nothing), never a look-alike fake value, so a
 * loading or error state can't be mistaken for someone's real data.
 */

/** First name for a greeting. null while loading or if no member is known. */
export function greetingFirstName(me: ServerMember | null | undefined): string | null {
  const name = me?.fullName?.trim();
  return name ? name.split(' ')[0] : null;
}

/** Member's display name, or null if genuinely unknown (never a fake name). */
export function displayMemberName(me: ServerMember | null | undefined): string | null {
  const name = me?.fullName?.trim();
  return name || null;
}

/** Member's card ID, or null if genuinely unknown (never a fake ID). */
export function displayMemberCode(me: ServerMember | null | undefined): string | null {
  const code = me?.memberCode?.trim();
  return code || null;
}

/** Member's district/electorate label, or null if genuinely unknown. */
export function displayDistrict(
  me: ServerMember | null | undefined,
  member: { electorateNameEn?: string | null } | null | undefined,
): string | null {
  const d = me?.districtName?.trim() || member?.electorateNameEn?.trim();
  return d || null;
}
