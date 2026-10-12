import { LoaderSkeleton } from '@/shared/components/ui/loaders-skeleton/LoaderSkeleton';
import { SkeletonCard } from '@/shared/components/ui/loaders-skeleton/SkeletonCard';
export function ProfileSkeleton() {
  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          borderRadius: 24,
          background: 'linear-gradient(135deg, #14263D 0%, #1B3050 100%)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: '0 12px 32px rgba(20, 38, 61, 0.18)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <LoaderSkeleton
            width={38}
            height={38}
            borderRadius={999}
            baseColor="rgba(255,255,255,0.12)"
          />
          <LoaderSkeleton
            width={38}
            height={38}
            borderRadius={999}
            baseColor="rgba(255,255,255,0.12)"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <LoaderSkeleton
            width={80}
            height={80}
            borderRadius={999}
            baseColor="rgba(255,255,255,0.18)"
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LoaderSkeleton
              width="75%"
              height={22}
              borderRadius={6}
              baseColor="rgba(255,255,255,0.18)"
            />
            <LoaderSkeleton
              width="48%"
              height={14}
              borderRadius={4}
              baseColor="rgba(255,255,255,0.12)"
            />
            <LoaderSkeleton
              width="32%"
              height={14}
              borderRadius={4}
              baseColor="rgba(255,255,255,0.12)"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <LoaderSkeleton
            width="50%"
            height={38}
            borderRadius={10}
            baseColor="rgba(255,255,255,0.15)"
          />
          <LoaderSkeleton
            width="50%"
            height={38}
            borderRadius={10}
            baseColor="rgba(255,255,255,0.15)"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <LoaderSkeleton height={72} borderRadius={14} />
        <LoaderSkeleton height={72} borderRadius={14} />
        <LoaderSkeleton height={72} borderRadius={14} />
      </div>

      <SkeletonCard height={140} />
      <SkeletonCard height={120} />
    </div>
  );
}
