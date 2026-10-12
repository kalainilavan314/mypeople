import { LoaderSkeleton } from '@/shared/components/ui/loaders-skeleton/LoaderSkeleton';
export function CommunitySkeleton() {
  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LoaderSkeleton width={170} height={28} borderRadius={6} />
      <LoaderSkeleton width="100%" height={46} borderRadius={12} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: 14,
              borderRadius: 16,
              border: '1px solid var(--hairline)',
              background: 'var(--card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <LoaderSkeleton width={40} height={40} borderRadius={12} />
            <LoaderSkeleton width="70%" height={16} borderRadius={4} />
            <LoaderSkeleton width="90%" height={12} borderRadius={4} />
          </div>
        ))}
      </div>
    </div>
  );
}
