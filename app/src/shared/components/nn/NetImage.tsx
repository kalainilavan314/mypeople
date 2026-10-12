import { c, grad } from '@/core/theme/tokens';
import { Icon, type IconName } from '@/shared/components/Icon';
import { useState, type CSSProperties } from 'react';

export function NetImage({
  src,
  alt,
  width,
  height,
  radius: r = 0,
  fallbackIcon = 'image',
  fallbackGrad = grad.primary,
  style,
}: {
  src?: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  fallbackIcon?: IconName;
  fallbackGrad?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const box: CSSProperties = {
    width: width ?? '100%',
    height: height ?? '100%',
    borderRadius: r,
    overflow: 'hidden',
    position: 'relative',
    background: c.surfaceVariant,
    flex: 'none',
    ...style,
  };

  if (!src || failed) {
    return (
      <div
        style={{
          ...box,
          background: fallbackGrad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="img"
        aria-label={alt}
      >
        <Icon name={fallbackIcon} size={22} color="rgba(255,255,255,.85)" strokeWidth={1.6} />
      </div>
    );
  }
  return (
    <div style={box}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 300ms var(--ease)',
        }}
      />
    </div>
  );
}
