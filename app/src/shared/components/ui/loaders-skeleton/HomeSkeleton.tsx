import { LoaderSkeleton } from '@/shared/components/ui/loaders-skeleton/LoaderSkeleton';
import { SkeletonCard } from '@/shared/components/ui/loaders-skeleton/SkeletonCard';
export function HomeSkeleton() {
  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LoaderSkeleton width={42} height={42} borderRadius={999} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <LoaderSkeleton width={90} height={12} borderRadius={4} />
            <LoaderSkeleton width={140} height={16} borderRadius={4} />
          </div>
        </div>
        <LoaderSkeleton width={38} height={38} borderRadius={999} />
      </div>

      <div
        style={{
          borderRadius: 22,
          background: 'linear-gradient(135deg, #14263D 0%, #1B3050 100%)',
          padding: '20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <LoaderSkeleton
            width={120}
            height={18}
            borderRadius={4}
            baseColor="rgba(255,255,255,0.2)"
          />
          <LoaderSkeleton
            width={50}
            height={20}
            borderRadius={999}
            baseColor="rgba(255,255,255,0.2)"
          />
        </div>
        <LoaderSkeleton
          width="85%"
          height={26}
          borderRadius={6}
          baseColor="rgba(255,255,255,0.2)"
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <LoaderSkeleton
            width={100}
            height={36}
            borderRadius={10}
            baseColor="rgba(255,255,255,0.16)"
          />
          <LoaderSkeleton
            width={100}
            height={36}
            borderRadius={10}
            baseColor="rgba(255,255,255,0.16)"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <LoaderSkeleton width={52} height={52} borderRadius={16} />
            <LoaderSkeleton width={42} height={10} borderRadius={3} />
          </div>
        ))}
      </div>

      <SkeletonCard height={140} />
      <SkeletonCard height={140} />
    </div>
  );
}
