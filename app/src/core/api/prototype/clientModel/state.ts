import { clone } from '@/core/api/prototype/clientModel/clone';
import * as seed from '@/core/api/prototype/seed';
import type {
  Announcement,
  Badge,
  Consents,
  Course,
  Idea,
  Member,
  Notification,
  NpmEvent,
  Report,
  RsvpStatus,
  Skill,
  Survey,
} from '@/core/api/types';
export const state = {
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
