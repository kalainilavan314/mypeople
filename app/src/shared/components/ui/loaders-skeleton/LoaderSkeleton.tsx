import { cn } from '@/core/lib/utils';
import { LoaderSkeletonProps } from '@/shared/components/ui/loaders-skeletonModel/LoaderSkeletonProps';
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
