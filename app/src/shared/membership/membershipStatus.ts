import type { ServerMember } from '@/core/api/auth/models';

export type MembershipStatus = NonNullable<ServerMember['membershipStatus']>;

type Text = { en: string; ta: string };

/**
 * The one membership state every screen shows. The API sends it with the
 * member; an older API that sends none means Pending, because nobody becomes
 * Active without an approval that API cannot record. (The QA audit found the
 * profile and the card each guessing differently.)
 */
export function membershipStateOf(member: Pick<ServerMember, 'membershipStatus'>): MembershipStatus {
  return member.membershipStatus ?? 'pending';
}

export const MEMBERSHIP_STATUS_TEXT: Record<MembershipStatus, { short: Text; long: Text }> = {
  pending: {
    short: { en: 'Pending', ta: 'நிலுவையில்' },
    long: { en: 'Membership pending', ta: 'உறுப்புரிமை நிலுவையில்' },
  },
  active: {
    short: { en: 'Active', ta: 'செயலில்' },
    long: { en: 'Membership active', ta: 'உறுப்புரிமை செயலில்' },
  },
  suspended: {
    short: { en: 'Suspended', ta: 'இடைநிறுத்தப்பட்டது' },
    long: { en: 'Membership suspended', ta: 'உறுப்புரிமை இடைநிறுத்தப்பட்டது' },
  },
  inactive: {
    short: { en: 'Inactive', ta: 'செயலற்றது' },
    long: { en: 'Membership inactive', ta: 'உறுப்புரிமை செயலற்றது' },
  },
};

/**
 * An official card, with a working check-in QR, needs a confirmed identity and an
 * Active membership (BRD BR-065, FR-CARD-014). The server applies the same rule
 * before it issues a QR; every other card is shown as provisional.
 */
export function hasOfficialCard(member: Pick<ServerMember, 'membershipStatus' | 'verificationStatus'>): boolean {
  return member.verificationStatus === 'identity_confirmed' && membershipStateOf(member) === 'active';
}
