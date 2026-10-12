import { c, font, radius, shadow } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  setShowSuccess: Dispatch<SetStateAction<boolean>>;
  onSubmitted: () => void;
  t: TFunction<'translation', undefined>;
};
export function ReportFormDiv({ setShowSuccess, onSubmitted, t }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={() => {
        setShowSuccess(false);
        onSubmitted();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(100% - 32px, 416px)',
          margin: '0 16px calc(16px + var(--safe-bottom))',
          background: c.card,
          borderRadius: radius.xxl,
          padding: 24,
          textAlign: 'center',
          boxShadow: shadow.lg,
        }}
      >
        <span
          style={{
            display: 'flex',
            width: 64,
            height: 64,
            margin: '0 auto',
            borderRadius: 999,
            background: c.successBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="check" size={32} color={c.success} strokeWidth={2.4} />
        </span>
        <div style={{ font: `700 20px/1.2 ${font.ta}`, color: c.ink, marginTop: 16 }}>
          {t('creport.successTitle', 'Report Submitted')}
        </div>
        <div style={{ font: `400 14px/1.5 ${font.ta}`, color: c.ink2, marginTop: 8 }}>
          {t(
            'creport.successBody',
            'Thank you for your report. Local coordinators will review it soon.',
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setShowSuccess(false);
            onSubmitted();
          }}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '14px 0',
            border: 'none',
            borderRadius: radius.lg,
            cursor: 'pointer',
            background: c.primary,
            color: c.onPrimary,
            font: `700 15px/1 ${font.ui}`,
          }}
        >
          {t('creport.done', 'Done')}
        </button>
      </div>
    </div>
  );
}
