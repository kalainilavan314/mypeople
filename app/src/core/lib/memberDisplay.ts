import type { ServerMember } from '@/core/api/authApi';

export function greetingFirstName(me: ServerMember | null | undefined): string | null {
  const name = me?.fullName?.trim();
  return name ? name.split(' ')[0] : null;
}

export function displayMemberName(me: ServerMember | null | undefined): string | null {
  const name = me?.fullName?.trim();
  return name || null;
}

export function displayMemberCode(me: ServerMember | null | undefined): string | null {
  const code = me?.memberCode?.trim();
  return code || null;
}

export function displayDistrict(
  me: ServerMember | null | undefined,
  member: { electorateNameEn?: string | null } | null | undefined,
): string | null {
  const d = me?.districtName?.trim() || member?.electorateNameEn?.trim();
  return d || null;
}
