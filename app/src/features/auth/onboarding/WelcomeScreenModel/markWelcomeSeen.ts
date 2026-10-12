import { WELCOME_SEEN } from '@/features/auth/onboarding/WelcomeScreenModel/WELCOME_SEEN';
export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN, '1');
  } catch {
    /* ignore */
  }
}
