import { compressImage } from '@/core/lib/image';
import { radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function NicPhotoTile({
  label,
  photo,
  onPick,
}: {
  label: string;
  photo: string | null;
  onPick: (dataUrl: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onPick(await compressImage(file));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={
          photo ? `${t('auth.nicPhotoRetake')} — ${label}` : `${t('auth.nicPhotoAdd')} — ${label}`
        }
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          borderRadius: radius.md,
          border: photo ? `1.5px solid #E2E8F0` : '1.5px dashed #94A3B8',
          background: photo ? `center / cover no-repeat url(${photo})` : '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: busy ? 'default' : 'pointer',
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {!photo && (
          <>
            <Icon name="camera" size={22} color="#64748B" strokeWidth={1.8} />
            <span
              style={{
                font: `600 11.5px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                color: '#64748B',
              }}
            >
              {busy ? '…' : t('auth.nicPhotoAdd')}
            </span>
          </>
        )}
        {photo && (
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              padding: '3px 8px',
              borderRadius: 999,
              background: 'rgba(15,23,42,0.72)',
              color: '#fff',
              font: `600 10.5px/1.4 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            }}
          >
            {t('auth.nicPhotoRetake')}
          </span>
        )}
      </button>
      <div
        style={{
          font: `500 11.5px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
          color: '#475569',
          marginTop: 6,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />
    </div>
  );
}
