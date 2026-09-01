// TypeScript types mirroring the Postgres 16 schema in PROJECT.md.
// Bilingual columns are `*Ta` / `*En`; the client picks by member.language, falls back to Tamil.

export type Lang = 'ta' | 'en' | 'si';
export type Tier = 'sprout' | 'root' | 'palmyra';
export type NicStatus = 'pending' | 'verified' | 'rejected';
export type ReportStatus = 'submitted' | 'under_review' | 'actioned';
export type ReportCategory = 'canvassing' | 'water' | 'roads' | 'land' | 'electricity';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

export interface Bilingual {
  ta: string;
  en: string;
}

export interface Electorate {
  id: string;
  nameTa: string;
  nameEn: string;
  district: string;
}

export interface Ward {
  id: string;
  electorateId: string;
  nameTa: string;
  nameEn: string;
}

export interface Member {
  id: string;
  memberCode: string; // NPM-JAF-004821
  fullName: string;
  phone: string; // +94xxxxxxxxx
  nicStatus: NicStatus;
  electorateId: string | null;
  wardId: string | null;
  tier: Tier; // derived + cached
  points: number;
  language: Lang;
  referredBy: string | null;
  referralCode: string; // KARU-4821
  joinedAt: string; // ISO
  // convenience (joined) fields
  electorateNameTa?: string;
  electorateNameEn?: string;
  wardNameTa?: string;
  wardNameEn?: string;
  avatarInitials?: string;
  referredCount?: number;
  checkInCount?: number;
}

export interface Announcement {
  id: string;
  titleTa: string;
  titleEn: string;
  bodyTa: string;
  bodyEn: string;
  photoUrl: string | null;
  pinned: boolean;
  scope: string | null;
  publishedAt: string;
  authorName: string;
  likes: number;
}

export interface AgendaItem {
  time: string;
  labelTa: string;
  labelEn: string;
}

export interface NpmEvent {
  id: string;
  titleTa: string;
  titleEn: string;
  venue: string;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string | null;
  electorateId: string | null;
  agenda: AgendaItem[];
  rsvpCount: number;
  isMine?: boolean; // in my ward
  distanceKm?: number;
  banner?: number; // gradient index for the Home carousel
  category?: string | null;
  myStatus?: RsvpStatus | null;
}

export interface SurveyOption {
  id: string;
  labelTa: string;
  labelEn: string;
  votes: number;
}

export interface SurveyQuestion {
  id: string;
  position: number;
  promptTa: string;
  promptEn: string;
  kind: 'single' | 'multi';
  options: SurveyOption[];
}

export interface Survey {
  id: string;
  titleTa: string;
  titleEn: string;
  closesAt: string;
  points: number;
  totalResponses: number;
  questions: SurveyQuestion[];
}

export interface ReportEventEntry {
  id: string;
  status: ReportStatus;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface Report {
  id: string;
  code: string; // RPT-2214
  memberId: string;
  category: ReportCategory;
  titleTa: string;
  bodyTa: string;
  transcriptTa: string | null;
  audioUrl: string | null;
  lat: number | null;
  lng: number | null;
  status: ReportStatus;
  photos: string[];
  clientUuid: string; // offline queue idempotency key
  createdAt: string;
  syncedAt: string | null;
  pending?: boolean; // client-only: queued, not yet synced
  timeline: ReportEventEntry[];
}

/* --- Community reporting (NorthUnity) — backend-backed ----------------------- */
export type CommunityReportCategory =
  | 'road' | 'water' | 'waste' | 'electricity'
  | 'agriculture' | 'environment' | 'public_facility' | 'other';
export type CommunityReportPriority = 'low' | 'medium' | 'high';
export type CommunityReportStatus = 'submitted' | 'under_review' | 'in_progress' | 'resolved';

export interface CommunityReport {
  id: string;
  category: CommunityReportCategory;
  title: string;
  description: string;
  districtCode: string | null;
  districtName: string | null;
  priority: CommunityReportPriority;
  status: CommunityReportStatus;
  createdAt: string;
}

export interface NewCommunityReport {
  category: CommunityReportCategory;
  title: string;
  description: string;
  districtCode: string | null;
  priority: CommunityReportPriority;
}

/* --- Party Fund donations (NorthUnity) — backend-backed ---------------------- */
export type DonationMethod = 'card' | 'slip';
export type DonationStatus = 'pending' | 'approved' | 'rejected';

export interface Donation {
  id: string;
  amount: number; // LKR
  method: DonationMethod;
  cardLast4: string | null;
  cardBrand: 'visa' | 'mastercard' | null;
  status: DonationStatus;
  note: string | null;
  createdAt: string;
  hasSlip: boolean;
  donorName?: string;
  districtName?: string | null;
}

export interface DonationBoard {
  total: number;
  count: number;
  donations: Donation[];
}

export interface Idea {
  id: string;
  memberId: string;
  authorName: string;
  bodyTa: string;
  status: 'submitted' | 'reviewing' | 'adopted';
  backings: number;
  backedByMe: boolean;
  createdAt: string;
}

export interface Badge {
  id: string;
  key: string;
  nameTa: string;
  nameEn: string;
  icon: string;
  earned: boolean;
}

export interface Skill {
  id: string;
  key: string;
  nameTa: string;
  nameEn: string;
  selected: boolean;
}

export interface Course {
  id: string;
  titleTa: string;
  titleEn: string;
  minutes: number;
  lessonsDone: number;
  lessonsTotal: number;
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

export interface Referral {
  code: string;
  referred: { name: string; status: 'verified' | 'pending'; joinedAt: string }[];
}
