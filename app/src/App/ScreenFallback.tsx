import { RouteSkeleton } from '@/shared/components/ui/loaders-skeleton';
import { useLocation } from 'react-router-dom';

export function ScreenFallback() {
  const { pathname } = useLocation();
  return <RouteSkeleton pathname={pathname} />;
}
