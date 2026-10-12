import type { ApiClient, NewReportInput } from '@/core/api/api';
import { accountPrototype } from '@/core/api/prototype/account';
import { categoryTitle } from '@/core/api/prototype/clientModel/categoryTitle';
import { clone } from '@/core/api/prototype/clientModel/clone';
import { delay } from '@/core/api/prototype/clientModel/delay';
import { isSeedGoing } from '@/core/api/prototype/clientModel/isSeedGoing';
import { state } from '@/core/api/prototype/clientModel/state';
import { withVotes } from '@/core/api/prototype/clientModel/withVotes';
import * as seed from '@/core/api/prototype/seed';
import { ack, enqueue, newClientUuid, pending } from '@/core/api/queue';
import type { ConsentKind, Idea, Referral, Report, RsvpStatus } from '@/core/api/types';
export const mockClient: ApiClient = {
  ...accountPrototype,

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
    return state.events.map((e) => ({
      ...clone(e),
      rsvpCount: e.rsvpCount + (state.rsvps[e.id] === 'going' && !isSeedGoing(e.id) ? 1 : 0),
    }));
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
      timeline: [
        {
          id: 'te-' + clientUuid.slice(0, 4),
          status: 'submitted',
          note: null,
          actorName: null,
          createdAt: now,
        },
      ],
    };

    await enqueue('report', clientUuid, input);
    state.reports.unshift(report);

    if (navigator.onLine) await this.flushOutbox();
    return clone(report);
  },
  async flushOutbox() {
    if (!navigator.onLine) return 0;
    const items = await pending();
    let synced = 0;
    for (const item of items) {
      await delay(120);

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
