import type { CSSProperties } from 'react';

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
