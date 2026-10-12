import { authC, font } from '@/core/theme/tokens';
import { useTranslation } from 'react-i18next';

export function Wordmark({ size = 30 }: { size?: number }) {
  const { t } = useTranslation();
  return (
    <div>
      <div
        style={{ font: `800 ${size}px/1.1 ${font.ta}`, letterSpacing: '-0.3px', color: authC.text }}
      >
        {t('brand.nameTa')}
      </div>
      <div
        style={{
          font: `600 ${Math.round(size * 0.52)}px/1.2 ${font.head}`,
          letterSpacing: '-0.2px',
          color: authC.green,
          marginTop: 2,
        }}
      >
        {t('brand.name')}
      </div>
    </div>
  );
}
