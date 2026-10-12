export interface TierProgress {
  have: number;
  next: 'diamond' | 'gold' | 'platinum' | null;
  need: number | null;
  pct: number;
  diamondNeed: number;
}
export interface ServerMember {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  nicStatus: string;
  dob: string | null;
  gender: string | null;
  gsCode: string | null;
  gsName: string | null;
  dsCode: string | null;
  dsName: string | null;
  districtCode: string | null;
  districtName: string | null;
  tier: 'volunteer' | 'diamond' | 'gold' | 'platinum';

  membershipStatus?: 'pending' | 'active' | 'suspended' | 'inactive';
  verificationStatus?: 'unverified' | 'nic_format' | 'review_pending' | 'identity_confirmed';
  verifiedAt?: string | null;
  referralCode: string;
  referredBy: string | null;
  recruitCount: number;
  language: string;
  joinedAt: string;
  tierProgress?: TierProgress;
  isAdmin?: boolean;
  avatarUrl?: string | null;
}
export interface SignupPayload {
  name: string;
  nic: string;

  phone?: string;
  password: string;
  dob: string | null;
  gender: string | null;
  districtCode: string | null;
  dsCode: string | null;
  gsCode: string | null;
  referralId: string;
  answers: Record<string, string>;
  language: string;

  inviteCode?: string;
}
export interface ProfileUpdate {
  name?: string;
  dob?: string | null;
  gender?: string | null;
  gsCode?: string | null;
  phone?: string | null;
  language?: string;
}
