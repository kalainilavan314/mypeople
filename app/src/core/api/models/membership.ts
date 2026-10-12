export type Lang = 'ta' | 'en' | 'si';
export type Tier = 'sprout' | 'root' | 'palmyra';
export type NicStatus = 'pending' | 'verified' | 'rejected';
export interface Member {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  nicStatus: NicStatus;
  electorateId: string | null;
  wardId: string | null;
  tier: Tier;
  points: number;
  language: Lang;
  referredBy: string | null;
  referralCode: string;
  joinedAt: string;

  electorateNameTa?: string;
  electorateNameEn?: string;
  wardNameTa?: string;
  wardNameEn?: string;
  avatarInitials?: string;
  referredCount?: number;
  checkInCount?: number;
}
export interface Referral {
  code: string;
  referred: { name: string; status: 'verified' | 'pending'; joinedAt: string }[];
}
export interface Badge {
  id: string;
  key: string;
  nameTa: string;
  nameEn: string;
  icon: string;
  earned: boolean;
}
export interface Notification {
  id: string;
  kind: string;
  titleTa: string;
  titleEn: string;
  bodyTa: string;
  bodyEn: string;
  deepLink: string;
  readAt: string | null;
  createdAt: string;
}
export type ConsentKind = 'data' | 'whatsapp' | 'research';
export type Consents = Record<ConsentKind, boolean>;
