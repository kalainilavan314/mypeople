import { LoaderSkeleton } from '@/shared/components/ui/loaders-skeleton/LoaderSkeleton';
import { SkeletonCard } from '@/shared/components/ui/loaders-skeleton/SkeletonCard';
export function EventsSkeleton() {
  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LoaderSkeleton width={160} height={28} borderRadius={6} />
      <LoaderSkeleton width="100%" height={46} borderRadius={12} />
      <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
        <LoaderSkeleton width={70} height={34} borderRadius={999} />
        <LoaderSkeleton width={80} height={34} borderRadius={999} />
        <LoaderSkeleton width={75} height={34} borderRadius={999} />
        <LoaderSkeleton width={90} height={34} borderRadius={999} />
      </div>
      <SkeletonCard height={150} />
      <SkeletonCard height={150} />
      <SkeletonCard height={150} />
    </div>
  );
}
