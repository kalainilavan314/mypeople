// The API contract the UI depends on. The mock adapter (mock/client.ts) implements this
// today; a real HTTP client against the Postgres backend implements the same interface later,
// so screens never change when the backend arrives.

import type {
  Announcement,
  Badge,
  Consents,
  ConsentKind,
  Course,
  Idea,
  Lang,
  Member,
  Notification,
  NpmEvent,
  Referral,
  Report,
  ReportCategory,
  RsvpStatus,
  Skill,
  Survey,
} from './types';

export interface NewReportInput {
  category: ReportCategory;
  titleTa: string;
  bodyTa: string;
  transcriptTa: string | null;
  hasAudio: boolean;
  photos: string[];
  lat: number | null;
  lng: number | null;
}

export interface SignUpInput {
  name: string;
  nic: string;
  phone: string;
  password: string;
}

export interface ApiClient {
  // identity
  getMember(): Promise<Member>;
  setLanguage(lang: Lang): Promise<Member>;

  // auth — NIC + password, with OTP-verified phone
  signUp(input: SignUpInput): Promise<{ ok: true }>;
  login(nic: string, password: string): Promise<{ ok: boolean; reason?: 'nic' | 'credentials' }>;
  verifyNic(nic: string): Promise<{ ok: boolean; status: 'verified' | 'pending' | 'rejected' }>;

  // onboarding (phone OTP)
  requestOtp(phone: string): Promise<{ ok: true }>;
  verifyOtp(phone: string, code: string): Promise<{ ok: boolean }>;
  submitNic(): Promise<{ status: 'pending' }>;

  // content
  getAnnouncements(): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement | undefined>;

  // events
  getEvents(): Promise<NpmEvent[]>;
  getEvent(id: string): Promise<NpmEvent | undefined>;
  setRsvp(eventId: string, status: RsvpStatus | null): Promise<NpmEvent>;
  checkIn(eventId: string): Promise<{ event: NpmEvent; pointsAwarded: number }>;

  // survey
  getSurvey(): Promise<Survey>;
  voteSurvey(questionId: string, optionId: string): Promise<Survey>;

  // reports (offline-first)
  getReports(): Promise<Report[]>;
  getReport(id: string): Promise<Report | undefined>;
  submitReport(input: NewReportInput): Promise<Report>;
  flushOutbox(): Promise<number>; // returns count synced

  // engagement
  getIdeas(): Promise<Idea[]>;
  submitIdea(bodyTa: string): Promise<Idea>;
  backIdea(id: string): Promise<Idea>;
  getBadges(): Promise<Badge[]>;
  getSkills(): Promise<Skill[]>;
  toggleSkill(id: string): Promise<Skill[]>;
  getCourses(): Promise<Course[]>;
  getNotifications(): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<Notification[]>;
  getConsents(): Promise<Consents>;
  setConsent(kind: ConsentKind, value: boolean): Promise<Consents>;
  getReferral(): Promise<Referral>;
}
