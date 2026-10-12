import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-tamil/900.css';

export type MembershipCredentialData = {
  name: string;
  memberId: string;
  district: string;
  gsDivision: string;
  memberSince: string;
  membershipType: string;
  referralId: string;
  verified: boolean;
  verificationLabel: string;
  avatarUrl?: string | null;
  signatureUrl?: string | null;
  qrValue?: string | null;
};
