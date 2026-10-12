import { useAuth } from '@/shared/hooks/useAuth';
import { Navigate, Outlet } from 'react-router-dom';

export function RedirectIfAuthed() {
  const { authed } = useAuth();
  if (authed) return <Navigate to="/" replace />;
  return <Outlet />;
}
