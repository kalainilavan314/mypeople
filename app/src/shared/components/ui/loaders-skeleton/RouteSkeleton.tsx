import { CommunitySkeleton } from '@/shared/components/ui/loaders-skeleton/CommunitySkeleton';
import { EventsSkeleton } from '@/shared/components/ui/loaders-skeleton/EventsSkeleton';
import { HomeSkeleton } from '@/shared/components/ui/loaders-skeleton/HomeSkeleton';
import { LoaderSkeleton } from '@/shared/components/ui/loaders-skeleton/LoaderSkeleton';
import { ProfileSkeleton } from '@/shared/components/ui/loaders-skeleton/ProfileSkeleton';
import { ReportsSkeleton } from '@/shared/components/ui/loaders-skeleton/ReportsSkeleton';
import { SkeletonCard } from '@/shared/components/ui/loaders-skeleton/SkeletonCard';
export function RouteSkeleton({ pathname }: { pathname: string }) {
  if (pathname === '/') return <HomeSkeleton />;
  if (pathname.startsWith('/events')) return <EventsSkeleton />;
  if (pathname.startsWith('/reports')) return <ReportsSkeleton />;
  if (pathname.startsWith('/community')) return <CommunitySkeleton />;
  if (pathname.startsWith('/profile')) return <ProfileSkeleton />;
  return (
    <div style={{ padding: '24px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LoaderSkeleton width={180} height={26} borderRadius={6} />
      <SkeletonCard height={140} />
      <SkeletonCard height={140} />
    </div>
  );
}
