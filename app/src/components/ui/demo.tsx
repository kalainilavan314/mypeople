import { LoaderSkeleton, SkeletonCard } from './loaders-skeleton';

export function SkeletonDemo() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: 300,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--page, #F8FAFC)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 20,
          border: '1px solid var(--hairline, #E2E8F0)',
          background: 'var(--card, #FFFFFF)',
          padding: 20,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LoaderSkeleton width={48} height={48} borderRadius={999} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LoaderSkeleton width="70%" height={14} borderRadius={4} />
            <LoaderSkeleton width="40%" height={12} borderRadius={4} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <LoaderSkeleton height={12} borderRadius={4} />
          <LoaderSkeleton height={12} borderRadius={4} />
          <LoaderSkeleton width="80%" height={12} borderRadius={4} />
        </div>

        <LoaderSkeleton height={120} borderRadius={12} />
        <SkeletonCard height={140} />
      </div>
    </div>
  );
}

export default SkeletonDemo;
