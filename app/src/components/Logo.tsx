import type { CSSProperties } from 'react';

/**
 * The "My People" / என் மக்கள் mark — cupped hands cradling five figures.
 *
 * A raster, not inline SVG: it is the organisation's actual logo with gradient
 * fills, and tracing it would drift from the real artwork. Served from public/
 * so it is precached by the service worker like any other static asset.
 *
 * Decorative by default — the brand name is always rendered as text beside it,
 * so screen readers should not hear it twice. Pass `alt` where the mark stands
 * alone with no accompanying wordmark.
 */
export function Logo({
  size = 32,
  alt,
  style,
}: {
  size?: number;
  alt?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL || '/'}logo.png`}
      width={size}
      height={size}
      alt={alt ?? ''}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      style={{ display: 'block', objectFit: 'contain', flex: 'none', ...style }}
    />
  );
}
