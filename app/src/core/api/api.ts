import type {
  Announcement,
  Badge,
  ConsentKind,
  Consents,
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
} from '@/core/api/types';

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
  getMember(): Promise<Member>;
  setLanguage(lang: Lang): Promise<Member>;

  signUp(input: SignUpInput): Promise<{ ok: true }>;
  login(nic: string, password: string): Promise<{ ok: boolean; reason?: 'nic' | 'credentials' }>;
  verifyNic(nic: string): Promise<{ ok: boolean; status: 'verified' | 'pending' | 'rejected' }>;

  requestOtp(phone: string): Promise<{ ok: true }>;
  verifyOtp(phone: string, code: string): Promise<{ ok: boolean }>;
  submitNic(): Promise<{ status: 'pending' }>;

  getAnnouncements(): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement | undefined>;

  getEvents(): Promise<NpmEvent[]>;
  getEvent(id: string): Promise<NpmEvent | undefined>;
  setRsvp(eventId: string, status: RsvpStatus | null): Promise<NpmEvent>;
  checkIn(eventId: string): Promise<{ event: NpmEvent; pointsAwarded: number }>;

  getSurvey(): Promise<Survey>;
  voteSurvey(questionId: string, optionId: string): Promise<Survey>;

  getReports(): Promise<Report[]>;
  getReport(id: string): Promise<Report | undefined>;
  submitReport(input: NewReportInput): Promise<Report>;
  flushOutbox(): Promise<number>;

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
