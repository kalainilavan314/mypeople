import { LoaderSkeleton } from '@/shared/components/ui/loaders-skeleton/LoaderSkeleton';
export function SkeletonProfileHeader() {
  return (
    <div
      style={{
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <LoaderSkeleton width={96} height={96} borderRadius={999} />
      <LoaderSkeleton width={180} height={20} borderRadius={6} />
      <LoaderSkeleton width={120} height={14} borderRadius={4} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <LoaderSkeleton width={80} height={32} borderRadius={999} />
        <LoaderSkeleton width={80} height={32} borderRadius={999} />
      </div>
    </div>
  );
}
