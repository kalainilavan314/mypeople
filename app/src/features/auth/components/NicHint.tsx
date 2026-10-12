import { parseNic } from '@/core/lib/nic';
import { authC, font } from '@/core/theme/tokens';
import { useTranslation } from 'react-i18next';

export function NicHint({
  info,
  touched,
}: {
  info: ReturnType<typeof parseNic>;
  touched: boolean;
}) {
  const { t } = useTranslation();
  if (!touched || info.valid) return null;
  return (
    <div
      style={{ font: `500 12px/1.4 ${font.ui}`, color: authC.error, marginTop: 8, marginBottom: 2 }}
    >
      {t('auth.errNic')}
    </div>
  );
}
