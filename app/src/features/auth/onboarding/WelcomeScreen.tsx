import { WELCOME_SEEN } from '@/features/auth/onboarding/WelcomeScreenModel/WELCOME_SEEN';
export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN) === '1';
  } catch {
    return true;
  }
}

export { Welcome } from '@/features/auth/onboarding/components/Welcome';
export { markWelcomeSeen } from '@/features/auth/onboarding/WelcomeScreenModel/markWelcomeSeen';
