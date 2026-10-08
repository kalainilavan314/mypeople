import * as React from 'react';
import { cn } from '../../lib/utils';

export interface LoaderSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  baseColor?: string;
  highlightColor?: string;
  duration?: number;
}

/**
 * High-performance Shimmer Loader Skeleton
 * Zero-dependency pure CSS shimmer animation matching NorthUnity design tokens.
 */
export function LoaderSkeleton({
  className,
  width = '100%',
  height = 20,
  borderRadius = 6,
  baseColor,
  highlightColor,
  duration = 1.5,
  style,
  ...props
}: LoaderSkeletonProps) {
  const highlight = highlightColor || 'rgba(255, 255, 255, 0.45)';

  return (
    <div
      className={cn('nu-skeleton-box', className)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        backgroundColor: baseColor || 'var(--hairline-2, #E2E8F0)',
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      <div
        className="nu-skeleton-shimmer"
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg, transparent 0%, ${highlight} 50%, transparent 100%)`,
          animation: `nuSkeletonSweep ${duration}s ease-in-out infinite`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/** Pre-composed Skeleton card for lists, feeds, and articles */
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

/** Pre-composed Skeleton for user profile headers */
export function SkeletonProfileHeader() {
  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
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

/** Home Page Shimmer Skeleton */
export function HomeSkeleton() {
  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top bar */}
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

      {/* Hero card */}
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
          <LoaderSkeleton width={120} height={18} borderRadius={4} baseColor="rgba(255,255,255,0.2)" />
          <LoaderSkeleton width={50} height={20} borderRadius={999} baseColor="rgba(255,255,255,0.2)" />
        </div>
        <LoaderSkeleton width="85%" height={26} borderRadius={6} baseColor="rgba(255,255,255,0.2)" />
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <LoaderSkeleton width={100} height={36} borderRadius={10} baseColor="rgba(255,255,255,0.16)" />
          <LoaderSkeleton width={100} height={36} borderRadius={10} baseColor="rgba(255,255,255,0.16)" />
        </div>
      </div>

      {/* 4x2 Quick destination grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <LoaderSkeleton width={52} height={52} borderRadius={16} />
            <LoaderSkeleton width={42} height={10} borderRadius={3} />
          </div>
        ))}
      </div>

      {/* 2 Feed Cards */}
      <SkeletonCard height={140} />
      <SkeletonCard height={140} />
    </div>
  );
}

/** Events Page Shimmer Skeleton */
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

/** Reports / Community Issues Shimmer Skeleton */
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

/** Community Page Shimmer Skeleton */
export function CommunitySkeleton() {
  return (
    <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <LoaderSkeleton width={170} height={28} borderRadius={6} />
      <LoaderSkeleton width="100%" height={46} borderRadius={12} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ padding: 14, borderRadius: 16, border: '1px solid var(--hairline)', background: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LoaderSkeleton width={40} height={40} borderRadius={12} />
            <LoaderSkeleton width="70%" height={16} borderRadius={4} />
            <LoaderSkeleton width="90%" height={12} borderRadius={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Profile Page Shimmer Skeleton */
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
          <LoaderSkeleton width={38} height={38} borderRadius={999} baseColor="rgba(255,255,255,0.12)" />
          <LoaderSkeleton width={38} height={38} borderRadius={999} baseColor="rgba(255,255,255,0.12)" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <LoaderSkeleton width={80} height={80} borderRadius={999} baseColor="rgba(255,255,255,0.18)" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LoaderSkeleton width="75%" height={22} borderRadius={6} baseColor="rgba(255,255,255,0.18)" />
            <LoaderSkeleton width="48%" height={14} borderRadius={4} baseColor="rgba(255,255,255,0.12)" />
            <LoaderSkeleton width="32%" height={14} borderRadius={4} baseColor="rgba(255,255,255,0.12)" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <LoaderSkeleton width="50%" height={38} borderRadius={10} baseColor="rgba(255,255,255,0.15)" />
          <LoaderSkeleton width="50%" height={38} borderRadius={10} baseColor="rgba(255,255,255,0.15)" />
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

/** Smart router dispatcher that returns the matching skeleton for any route */
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

export default LoaderSkeleton;

