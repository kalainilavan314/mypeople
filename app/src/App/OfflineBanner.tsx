import { c, font } from '@/core/theme/tokens';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      style={{
        flex: 'none',
        background: c.warningBg,
        color: c.warning,
        font: `600 12px/1.4 ${font.ui}`,
        textAlign: 'center',
        padding: '6px 12px',
      }}
    >
      {t('common.offline')} · {t('reports.willSync')}
    </div>
  );
}
