import { authC, font } from '@/core/theme/tokens';
import { useTranslation } from 'react-i18next';

export function NameHint({ name, touched }: { name: string; touched: boolean }) {
  const { t } = useTranslation();
  if (!touched || name.trim().length >= 2) return null;
  return (
    <div
      style={{ font: `500 12px/1.4 ${font.ui}`, color: authC.error, marginTop: 8, marginBottom: 2 }}
    >
      {t('auth.errName')}
    </div>
  );
}
