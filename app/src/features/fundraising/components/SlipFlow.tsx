import { useSubmitSlipDonation } from '@/core/api/queries';
import { compressImage } from '@/core/lib/image';
import { c, font, radius } from '@/core/theme/tokens';
import { BankDetails } from '@/features/fundraising/components/BankDetails';
import { SlipFlowSheet } from '@/features/fundraising/components/SlipFlowSections/SlipFlowSheet';
import { fmtLKR } from '@/features/fundraising/PartyFund.model';
import { Icon } from '@/shared/components/Icon';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export function SlipFlow({ amount, onDone }: { amount: number; onDone: () => void }) {
  const { t } = useTranslation();
  const submit = useSubmitSlipDonation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onFile = async (f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    try {
      setPreview(await compressImage(f));
    } catch {
      setError(t('fund.badImage'));
    }
  };

  const send = async () => {
    setError(null);
    if (!preview) return setError(t('fund.needSlip'));
    try {
      await submit.mutateAsync({ amount, image: preview });
      setDone(true);
      setPreview(null);
    } catch {
      setError(navigator.onLine ? t('fund.error') : t('creport.offline'));
    }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, marginBottom: 8 }}>
        {t('fund.slipTitle')}
      </div>
      <div
        style={{
          padding: 14,
          background: c.secondaryContainer,
          border: '1px solid rgba(74,144,217,.24)',
          borderRadius: radius.md,
          font: `400 13px/1.5 ${font.ta}`,
          color: 'var(--on-secondary-container)',
        }}
      >
        {t('fund.slipInfo')}
      </div>

      <BankDetails />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <button
          onClick={() => cameraRef.current?.click()}
          className="press"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '13px 0',
            borderRadius: radius.md,
            border: `1px solid ${c.hairline2}`,
            background: c.card,
            cursor: 'pointer',
            font: `600 13px/1 ${font.ta}`,
            color: c.ink0,
          }}
        >
          <Icon name="camera" size={18} color={c.primary} /> {t('fund.takePhoto')}
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          className="press"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '13px 0',
            borderRadius: radius.md,
            border: `1px solid ${c.hairline2}`,
            background: c.card,
            cursor: 'pointer',
            font: `600 13px/1 ${font.ta}`,
            color: c.ink0,
          }}
        >
          <Icon name="image" size={18} color={c.primary} /> {t('fund.chooseImage')}
        </button>
      </div>

      {preview && (
        <div style={{ position: 'relative', marginTop: 12 }}>
          <img
            src={preview}
            alt={t('fund.slipTitle')}
            style={{
              width: '100%',
              borderRadius: radius.md,
              border: `1px solid ${c.hairline}`,
              display: 'block',
            }}
          />
          <button
            onClick={() => setPreview(null)}
            aria-label={t('common.close', 'Remove')}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 30,
              height: 30,
              borderRadius: 999,
              border: 'none',
              background: 'rgba(0,0,0,.55)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="x" size={15} color="#fff" strokeWidth={2.4} />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '11px 14px',
            background: c.errorBg,
            color: c.error,
            borderRadius: radius.md,
            font: `500 13px/1.4 ${font.ta}`,
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={send}
        disabled={submit.isPending}
        className="press"
        style={{
          width: '100%',
          marginTop: 16,
          padding: '15px 0',
          border: 'none',
          borderRadius: radius.lg,
          cursor: 'pointer',
          background: c.primary,
          color: '#fff',
          font: `700 15px/1 ${font.ta}`,
          boxShadow: '0 8px 22px -8px rgba(20,38,61,.55)',
        }}
      >
        {submit.isPending ? t('common.loading') : t('fund.submitSlip', { amount: fmtLKR(amount) })}
      </button>

      {done && <SlipFlowSheet setDone={setDone} onDone={onDone} t={t} />}
    </div>
  );
}
