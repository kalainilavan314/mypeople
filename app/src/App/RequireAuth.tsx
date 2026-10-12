import { TabLayout } from '@/App/TabLayout';
import { hasSeenWelcome } from '@/features/auth/onboarding/WelcomeScreen';
import { useAuth } from '@/shared/hooks/useAuth';
import { Navigate } from 'react-router-dom';
export function RequireAuth() {
  const { authed } = useAuth();
  if (!authed) return <Navigate to={hasSeenWelcome() ? '/login' : '/welcome'} replace />;
  return <TabLayout />;
}
