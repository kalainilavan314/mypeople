import type { Donation } from '@/core/api/types';
import { c, font } from '@/core/theme/tokens';
import { useTranslation } from 'react-i18next';

export function StatusChip({ status }: { status: Donation['status'] }) {
  const { t } = useTranslation();
  const tone = status === 'approved' ? c.success : status === 'rejected' ? c.error : c.warning;
  return (
    <span
      style={{
        font: `600 10.5px/1 ${font.ta}`,
        color: tone,
        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
        padding: '5px 9px',
        borderRadius: 8,
      }}
    >
      {t(`fund.status.${status}`)}
    </span>
  );
}
