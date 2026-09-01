// React Query hooks over the ApiClient. Keys are centralised so mutations can invalidate cleanly.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './index';
import {
  confirmCardDonation,
  getDonationBoard,
  getMyCommunityReports,
  getMyDonations,
  getPendingDonations,
  reviewDonation,
  submitCommunityReport,
  submitSlipDonation,
} from './httpContent';
import type { ConsentKind, Lang, NewCommunityReport, RsvpStatus } from './types';
import type { NewReportInput } from './api';

export const keys = {
  member: ['member'] as const,
  announcements: ['announcements'] as const,
  announcement: (id: string) => ['announcement', id] as const,
  events: ['events'] as const,
  event: (id: string) => ['event', id] as const,
  survey: ['survey'] as const,
  reports: ['reports'] as const,
  report: (id: string) => ['report', id] as const,
  ideas: ['ideas'] as const,
  badges: ['badges'] as const,
  skills: ['skills'] as const,
  courses: ['courses'] as const,
  notifications: ['notifications'] as const,
  consents: ['consents'] as const,
  referral: ['referral'] as const,
  myCommunityReports: ['communityReports', 'mine'] as const,
  donationBoard: ['donations', 'board'] as const,
  myDonations: ['donations', 'mine'] as const,
  pendingDonations: ['donations', 'pending'] as const,
};

export const useMember = () => useQuery({ queryKey: keys.member, queryFn: () => api.getMember() });
export const useAnnouncements = () => useQuery({ queryKey: keys.announcements, queryFn: () => api.getAnnouncements() });
export const useAnnouncement = (id: string) =>
  useQuery({ queryKey: keys.announcement(id), queryFn: () => api.getAnnouncement(id), enabled: !!id });
export const useEvents = () => useQuery({ queryKey: keys.events, queryFn: () => api.getEvents() });
export const useEvent = (id: string) =>
  useQuery({ queryKey: keys.event(id), queryFn: () => api.getEvent(id), enabled: !!id });
export const useSurvey = () => useQuery({ queryKey: keys.survey, queryFn: () => api.getSurvey() });
export const useReports = () => useQuery({ queryKey: keys.reports, queryFn: () => api.getReports() });
export const useReport = (id: string) =>
  useQuery({ queryKey: keys.report(id), queryFn: () => api.getReport(id), enabled: !!id });
export const useIdeas = () => useQuery({ queryKey: keys.ideas, queryFn: () => api.getIdeas() });
export const useBadges = () => useQuery({ queryKey: keys.badges, queryFn: () => api.getBadges() });
export const useSkills = () => useQuery({ queryKey: keys.skills, queryFn: () => api.getSkills() });
export const useCourses = () => useQuery({ queryKey: keys.courses, queryFn: () => api.getCourses() });
export const useNotifications = () => useQuery({ queryKey: keys.notifications, queryFn: () => api.getNotifications() });
export const useConsents = () => useQuery({ queryKey: keys.consents, queryFn: () => api.getConsents() });
export const useReferral = () => useQuery({ queryKey: keys.referral, queryFn: () => api.getReferral() });

export function useSetLanguage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lang: Lang) => api.setLanguage(lang),
    onSuccess: (member) => qc.setQueryData(keys.member, member),
  });
}

export function useSetRsvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: RsvpStatus | null }) =>
      api.setRsvp(eventId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.events });
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.checkIn(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.member });
      qc.invalidateQueries({ queryKey: keys.events });
    },
  });
}

export function useVoteSurvey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, optionId }: { questionId: string; optionId: string }) =>
      api.voteSurvey(questionId, optionId),
    onSuccess: (survey) => qc.setQueryData(keys.survey, survey),
  });
}

export function useSubmitReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewReportInput) => api.submitReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.reports }),
  });
}

/* --- Community reporting (NorthUnity, backend-backed) ------------------------ */
export const useMyCommunityReports = () =>
  useQuery({ queryKey: keys.myCommunityReports, queryFn: getMyCommunityReports });

export function useSubmitCommunityReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCommunityReport) => submitCommunityReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.myCommunityReports }),
  });
}

/* --- Party Fund donations (backend-backed) ------------------------------------ */
export const useDonationBoard = () =>
  useQuery({ queryKey: keys.donationBoard, queryFn: getDonationBoard });

export const useMyDonations = () =>
  useQuery({ queryKey: keys.myDonations, queryFn: getMyDonations });

export const usePendingDonations = (enabled: boolean) =>
  useQuery({ queryKey: keys.pendingDonations, queryFn: getPendingDonations, enabled });

export function useConfirmCardDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmCardDonation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.donationBoard });
      qc.invalidateQueries({ queryKey: keys.myDonations });
    },
  });
}

export function useSubmitSlipDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitSlipDonation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.myDonations });
    },
  });
}

export function useReviewDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
      reviewDonation(id, action, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.pendingDonations });
      qc.invalidateQueries({ queryKey: keys.donationBoard });
      qc.invalidateQueries({ queryKey: keys.myDonations });
    },
  });
}

export function useSubmitIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bodyTa: string) => api.submitIdea(bodyTa),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ideas }),
  });
}

export function useBackIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.backIdea(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ideas }),
  });
}

export function useToggleSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.toggleSkill(id),
    onSuccess: (skills) => qc.setQueryData(keys.skills, skills),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: (list) => qc.setQueryData(keys.notifications, list),
  });
}

export function useSetConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, value }: { kind: ConsentKind; value: boolean }) => api.setConsent(kind, value),
    onSuccess: (consents) => qc.setQueryData(keys.consents, consents),
  });
}
