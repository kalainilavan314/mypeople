import { lazy } from 'react';
export const named = <M, K extends keyof M>(p: Promise<M>, k: K) =>
  p.then((m) => ({ default: m[k] as React.ComponentType }));
export const Announcement = lazy(() =>
  named(import('@/features/community/AnnouncementScreen'), 'Announcement'),
);
export const Card = lazy(() => named(import('@/features/card/CardScreen'), 'Card'));
export const Community = lazy(() =>
  named(import('@/features/community/CommunityScreen'), 'Community'),
);
export const Courses = lazy(() => named(import('@/features/learning/CoursesScreen'), 'Courses'));
export const EditProfile = lazy(() =>
  named(import('@/features/profile/EditProfileScreen'), 'EditProfile'),
);
export const EventDetail = lazy(() =>
  named(import('@/features/events/EventDetailScreen'), 'EventDetail'),
);
export const Events = lazy(() => named(import('@/features/events/EventsScreen'), 'Events'));
export const Forgot = lazy(() => named(import('@/features/auth/ForgotScreen'), 'Forgot'));
export const Gallery = lazy(() => named(import('@/features/gallery/GalleryScreen'), 'Gallery'));
export const Ideas = lazy(() => named(import('@/features/ideas/IdeasScreen'), 'Ideas'));
export const Join = lazy(() => named(import('@/features/auth/onboarding/JoinScreen'), 'Join'));
export const Language = lazy(() => named(import('@/features/profile/LanguageScreen'), 'Language'));
export const Milestones = lazy(() =>
  named(import('@/features/card/MilestonesScreen'), 'Milestones'),
);
export const MyArea = lazy(() => named(import('@/features/community/MyAreaScreen'), 'MyArea'));
export const Nic = lazy(() => named(import('@/features/auth/onboarding/NicScreen'), 'Nic'));
export const Notifications = lazy(() =>
  named(import('@/features/profile/NotificationsScreen'), 'Notifications'),
);
export const Otp = lazy(() => named(import('@/features/auth/onboarding/OtpScreen'), 'Otp'));
export const PartyFund = lazy(() =>
  named(import('@/features/fundraising/PartyFundScreen'), 'PartyFund'),
);
export const Pending = lazy(() =>
  named(import('@/features/auth/onboarding/PendingScreen'), 'Pending'),
);
export function prefetchMemberRoutes() {
  const load = [
    () => import('@/features/card/CardScreen'),
    () => import('@/features/events/EventsScreen'),
    () => import('@/features/gallery/GalleryScreen'),
    () => import('@/features/profile/ProfileScreen'),
    () => import('@/features/reports/ReportsScreen'),
    () => import('@/features/community/CommunityScreen'),
    () => import('@/features/community/MyAreaScreen'),
    () => import('@/features/learning/SkillsScreen'),
    () => import('@/features/fundraising/PartyFundScreen'),
    () => import('@/features/profile/EditProfileScreen'),
    () => import('@/features/referrals/ReferralScreen'),
    () => import('@/features/card/MilestonesScreen'),
    () => import('@/features/profile/NotificationsScreen'),
    () => import('@/features/surveys/SurveyScreen'),
    () => import('@/features/ideas/IdeasScreen'),
    () => import('@/features/learning/CoursesScreen'),
    () => import('@/features/profile/LanguageScreen'),
    () => import('@/features/profile/PrivacyScreen'),
    () => import('@/features/events/EventDetailScreen'),
  ];
  load.forEach((fn, i) =>
    setTimeout(() => {
      void fn().catch(() => {});
    }, i * 140),
  );
}
export const Privacy = lazy(() => named(import('@/features/profile/PrivacyScreen'), 'Privacy'));
export const Profile = lazy(() => named(import('@/features/profile/ProfileScreen'), 'Profile'));
export const ProfileSetup = lazy(() =>
  named(import('@/features/auth/ProfileSetupScreen'), 'ProfileSetup'),
);
export const Questions = lazy(() => named(import('@/features/auth/QuestionsScreen'), 'Questions'));
export const Referral = lazy(() =>
  named(import('@/features/referrals/ReferralScreen'), 'Referral'),
);
export const Reports = lazy(() => named(import('@/features/reports/ReportsScreen'), 'Reports'));
export const SignUp = lazy(() => named(import('@/features/auth/RegisterScreen'), 'SignUp'));
export const Skills = lazy(() => named(import('@/features/learning/SkillsScreen'), 'Skills'));
export const Survey = lazy(() => named(import('@/features/surveys/SurveyScreen'), 'Survey'));
