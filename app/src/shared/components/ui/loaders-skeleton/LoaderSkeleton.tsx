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
  return (
    <div
      className={cn('nu-skeleton-box', className)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        backgroundColor: baseColor || highlightColor || 'var(--hairline-2, #E2E8F0)',
        animation: `nuSkeletonPulse ${duration}s ease-in-out infinite`,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}
