import { cn } from '@/core/lib/utils';
import { LoaderSkeleton } from '@/shared/components/ui/loaders-skeleton/LoaderSkeleton';
export function SkeletonCard({ height = 160, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn('nu-skeleton-card', className)}
      style={{
        padding: 16,
        background: 'var(--card, #FFFFFF)',
        border: '1px solid var(--hairline, #E2E8F0)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LoaderSkeleton width={44} height={44} borderRadius={999} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <LoaderSkeleton width="60%" height={14} borderRadius={4} />
          <LoaderSkeleton width="35%" height={12} borderRadius={4} />
        </div>
      </div>
      <LoaderSkeleton width="100%" height={height - 80} borderRadius={10} />
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <LoaderSkeleton width="80%" height={12} borderRadius={4} />
        <LoaderSkeleton width="20%" height={12} borderRadius={4} />
      </div>
    </div>
  );
}
