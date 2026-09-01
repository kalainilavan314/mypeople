// In-memory mock adapter implementing ApiClient. Lets the whole app run with zero backend.
// Report submission goes through the real IndexedDB outbox so the offline path is exercised
// exactly as it will be in production.

import type { ApiClient, NewReportInput, SignUpInput } from '../api';
import { parseNic } from '../../lib/nic';
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
  RsvpStatus,
  Skill,
  Survey,
} from '../types';
import * as seed from './seed';
import { ack, enqueue, newClientUuid, pending } from '../queue';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

/** Two-letter initials from a name, e.g. "Anitha Rajan" -> "AR". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Mutable session state (seeded).
const state = {
  member: clone(seed.currentMember) as Member,
  announcements: clone(seed.announcements) as Announcement[],
  events: clone(seed.events) as NpmEvent[],
  survey: clone(seed.survey) as Survey,
  reports: clone(seed.reports) as Report[],
  ideas: clone(seed.ideas) as Idea[],
  badges: clone(seed.badges) as Badge[],
  skills: clone(seed.skills) as Skill[],
  courses: clone(seed.courses) as Course[],
  notifications: clone(seed.notifications) as Notification[],
  consents: { data: true, whatsapp: true, research: false } as Consents,
  votes: {} as Record<string, string>, // questionId -> optionId
  rsvps: {} as Record<string, RsvpStatus | null>,
};

// The seeded "going" state: second event is going by default (matches prototype rsvp.b = true).
state.rsvps['ev-convention'] = 'going';

function applyRsvpCounts(): void {
  state.events = state.events.map((e) => ({ ...e }));
}
applyRsvpCounts();

export const mockClient: ApiClient = {
  async getMember() {
    await delay();
    // Show the name the user entered at sign-up (persisted across reloads).
    const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('npm.name') : null;
    if (savedName) {
      state.member.fullName = savedName;
      state.member.avatarInitials = initials(savedName);
    }
    return clone(state.member);
  },

  async setLanguage(lang: Lang) {
    await delay(80);
    state.member.language = lang;
    return clone(state.member);
  },

  async signUp(input: SignUpInput) {
    await delay(500);
    // Mock: persist name/NIC/phone onto the session member. A real backend would
    // create the row, hash the password server-side, and queue NIC for review.
    if (input.name.trim()) {
      state.member.fullName = input.name.trim();
      state.member.avatarInitials = initials(input.name);
      if (typeof localStorage !== 'undefined') localStorage.setItem('npm.name', input.name.trim());
    }
    state.member.nicStatus = 'pending';
    return { ok: true } as const;
  },
  async login(nic: string, password: string) {
    await delay(500);
    if (!parseNic(nic).valid) return { ok: false, reason: 'nic' as const };
    if (password.trim().length < 6) return { ok: false, reason: 'credentials' as const };
    // Mock: any well-formed NIC + 6+ char password signs in as the seeded member.
    return { ok: true };
  },
  async verifyNic(nic: string) {
    await delay(700);
    const info = parseNic(nic);
    const status = info.valid ? ('verified' as const) : ('rejected' as const);
    state.member.nicStatus = status === 'verified' ? 'verified' : 'rejected';
    return { ok: info.valid, status };
  },

  async requestOtp(_phone: string) {
    await delay(500);
    return { ok: true } as const;
  },
  async verifyOtp(_phone: string, code: string) {
    await delay(400);
    // Mock: any 6-digit code verifies.
    return { ok: code.replace(/\D/g, '').length >= 6 };
  },
  async submitNic() {
    await delay(500);
    state.member.nicStatus = 'pending';
    return { status: 'pending' } as const;
  },

  async getAnnouncements() {
    await delay();
    return clone(state.announcements);
  },
  async getAnnouncement(id: string) {
    await delay();
    return clone(state.announcements.find((a) => a.id === id));
  },

  async getEvents() {
    await delay();
    return state.events.map((e) => ({ ...clone(e), rsvpCount: e.rsvpCount + (state.rsvps[e.id] === 'going' && !isSeedGoing(e.id) ? 1 : 0) }));
  },
  async getEvent(id: string) {
    await delay();
    const e = state.events.find((x) => x.id === id);
    return e ? clone(e) : undefined;
  },
  async setRsvp(eventId: string, status: RsvpStatus | null) {
    await delay(120);
    state.rsvps[eventId] = status;
    const e = state.events.find((x) => x.id === eventId)!;
    return clone(e);
  },
  async checkIn(eventId: string) {
    await delay(300);
    const e = state.events.find((x) => x.id === eventId)!;
    state.member.points += 50;
    state.member.checkInCount = (state.member.checkInCount ?? 0) + 1;
    return { event: clone(e), pointsAwarded: 50 };
  },

  async getSurvey() {
    await delay();
    return withVotes(state.survey);
  },
  async voteSurvey(questionId: string, optionId: string) {
    await delay(150);
    if (!state.votes[questionId]) {
      state.votes[questionId] = optionId;
      const q = state.survey.questions.find((x) => x.id === questionId);
      const o = q?.options.find((x) => x.id === optionId);
      if (o) o.votes += 1;
    }
    return withVotes(state.survey);
  },

  async getReports() {
    await delay();
    return clone(state.reports).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getReport(id: string) {
    await delay();
    return clone(state.reports.find((r) => r.id === id));
  },
  async submitReport(input: NewReportInput) {
    const clientUuid = newClientUuid();
    const now = new Date().toISOString();
    const report: Report = {
      id: 'r-' + clientUuid.slice(0, 6),
      code: 'RPT-' + Math.floor(2215 + Math.random() * 200),
      memberId: state.member.id,
      category: input.category,
      titleTa: input.titleTa || categoryTitle(input.category),
      bodyTa: input.bodyTa,
      transcriptTa: input.transcriptTa,
      audioUrl: input.hasAudio ? 'local://audio' : null,
      lat: input.lat,
      lng: input.lng,
      status: 'submitted',
      photos: input.photos,
      clientUuid,
      createdAt: now,
      syncedAt: null,
      pending: true,
      timeline: [{ id: 'te-' + clientUuid.slice(0, 4), status: 'submitted', note: null, actorName: null, createdAt: now }],
    };
    // Enqueue to the offline outbox (idempotent by clientUuid), then optimistically show it.
    await enqueue('report', clientUuid, input);
    state.reports.unshift(report);
    // If online, try to flush right away.
    if (navigator.onLine) await this.flushOutbox();
    return clone(report);
  },
  async flushOutbox() {
    if (!navigator.onLine) return 0;
    const items = await pending();
    let synced = 0;
    for (const item of items) {
      await delay(120);
      // Server upserts on clientUuid — safe against replay.
      const report = state.reports.find((r) => r.clientUuid === item.clientUuid);
      if (report && report.pending) {
        report.pending = false;
        report.syncedAt = new Date().toISOString();
      }
      await ack(item.clientUuid);
      synced += 1;
    }
    return synced;
  },

  async getIdeas() {
    await delay();
    return clone(state.ideas).sort((a, b) => b.backings - a.backings);
  },
  async submitIdea(bodyTa: string) {
    await delay(200);
    const idea: Idea = {
      id: 'i-' + Date.now(),
      memberId: state.member.id,
      authorName: state.member.fullName,
      bodyTa,
      status: 'submitted',
      backings: 0,
      backedByMe: false,
      createdAt: new Date().toISOString(),
    };
    state.ideas.unshift(idea);
    return clone(idea);
  },
  async backIdea(id: string) {
    await delay(120);
    const idea = state.ideas.find((i) => i.id === id)!;
    idea.backedByMe = !idea.backedByMe;
    idea.backings += idea.backedByMe ? 1 : -1;
    return clone(idea);
  },

  async getBadges() {
    await delay();
    return clone(state.badges);
  },
  async getSkills() {
    await delay();
    return clone(state.skills);
  },
  async toggleSkill(id: string) {
    await delay(80);
    const s = state.skills.find((x) => x.id === id);
    if (s) s.selected = !s.selected;
    return clone(state.skills);
  },
  async getCourses() {
    await delay();
    return clone(state.courses);
  },

  async getNotifications() {
    await delay();
    return clone(state.notifications);
  },
  async markNotificationRead(id: string) {
    await delay(60);
    const n = state.notifications.find((x) => x.id === id);
    if (n && !n.readAt) n.readAt = new Date().toISOString();
    return clone(state.notifications);
  },

  async getConsents() {
    await delay();
    return { ...state.consents };
  },
  async setConsent(kind: ConsentKind, value: boolean) {
    await delay(60);
    state.consents[kind] = value;
    return { ...state.consents };
  },

  async getReferral(): Promise<Referral> {
    await delay();
    return { code: state.member.referralCode, referred: clone(seed.referredList) };
  },
};

function isSeedGoing(eventId: string): boolean {
  return eventId === 'ev-convention';
}

function withVotes(survey: Survey): Survey {
  // Vote counts already live on options; the per-question chosen option is read via votedOption().
  return clone(survey);
}

function categoryTitle(cat: string): string {
  const map: Record<string, string> = {
    canvassing: 'பிரசாரம்',
    water: 'குடிநீர்',
    roads: 'சாலை',
    land: 'நிலம்',
    electricity: 'மின்சாரம்',
  };
  return map[cat] ?? 'அறிக்கை';
}

// Expose current vote map for screens that need to reflect it.
export function votedOption(questionId: string): string | undefined {
  return state.votes[questionId];
}
export function currentRsvp(eventId: string): RsvpStatus | null {
  return state.rsvps[eventId] ?? null;
}
