import { PalmSilhouette } from '@/features/auth/components/components/PalmSilhouette';
import { useState, type ReactNode } from 'react';
export function HeroPanel({
  height = '46vh',
  children,
}: {
  height?: number | string;
  children?: ReactNode;
}) {
  const [imgOk, setImgOk] = useState(true);
  const base = import.meta.env.BASE_URL || '/';
  return (
    <div
      style={{
        position: 'relative',
        height,
        minHeight: 300,
        maxHeight: 460,
        flex: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, #F6BE72 0%, #E39457 22%, #B06A55 44%, #5C4A63 66%, #22284A 88%, #0B1020 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(60% 34% at 72% 18%, rgba(255,214,150,.5), transparent 62%)',
        }}
      />
      <PalmSilhouette style={{ position: 'absolute', left: 20, bottom: '30%' }} />
      <PalmSilhouette
        style={{ position: 'absolute', left: 74, bottom: '32%', transform: 'scale(.8)' }}
      />
      <PalmSilhouette
        style={{ position: 'absolute', right: 26, bottom: '29%', transform: 'scaleX(-1)' }}
      />

      <img
        src={`${base}login-hero.png`}
        alt=""
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.dataset.triedJpg) {
            img.dataset.triedJpg = '1';
            img.src = `${base}login-hero.jpg`;
          } else {
            setImgOk(false);
          }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 28%',
          display: imgOk ? 'block' : 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 150,
          background:
            'linear-gradient(to top, rgba(15,22,38,.62) 0%, rgba(15,22,38,.28) 40%, transparent 100%)',
        }}
      />
      {children && (
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>{children}</div>
      )}
    </div>
  );
}
