import { c, font, radius, shadow } from '@/core/theme/tokens';
import { fmtDate, reportReference } from '@/features/reports/Reports.model';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';

type Props = {
  receipt: { id: string; createdAt: string };
  onClose: () => void;
  t: TFunction<'translation', undefined>;
};

/** The submission receipt: what was received, its reference, and where to follow it. */
export function ReportFormDiv({ receipt, onClose, t }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cr-receipt-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
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
        <h2 id="cr-receipt-title" style={{ font: `700 20px/1.3 ${font.ui}`, color: c.ink, margin: '16px 0 0' }}>
          {t('creport.successTitle')}
        </h2>
        <p style={{ font: `600 16px/1.4 ${font.mono}`, color: c.ink, margin: '12px 0 0' }}>
          {t('creport.receiptRef', { ref: reportReference(receipt.id) })}
        </p>
        <p style={{ font: `400 14px/1.5 ${font.ui}`, color: c.ink2, margin: '4px 0 0' }}>
          {fmtDate(receipt.createdAt)}
        </p>
        <p style={{ font: `400 15px/1.6 ${font.ui}`, color: c.ink2, margin: '12px 0 0' }}>
          {t('creport.receiptStatus')}
        </p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          style={{
            width: '100%',
            minHeight: 48,
            marginTop: 20,
            padding: '12px 0',
            border: 'none',
            borderRadius: radius.lg,
            cursor: 'pointer',
            background: c.primary,
            color: c.onPrimary,
            font: `700 16px/1.2 ${font.ui}`,
          }}
        >
          {t('creport.viewMine')}
        </button>
      </div>
    </div>
  );
}
