import { LoaderSkeleton } from '@/shared/components/ui/loaders-skeleton/LoaderSkeleton';
import { SkeletonCard } from '@/shared/components/ui/loaders-skeleton/SkeletonCard';
export function ReportsSkeleton() {
  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LoaderSkeleton width={180} height={28} borderRadius={6} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <LoaderSkeleton height={60} borderRadius={12} />
        <LoaderSkeleton height={60} borderRadius={12} />
        <LoaderSkeleton height={60} borderRadius={12} />
      </div>
      <LoaderSkeleton width="100%" height={46} borderRadius={12} />
      <SkeletonCard height={130} />
      <SkeletonCard height={130} />
    </div>
  );
}
