import { authC } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { useTranslation } from 'react-i18next';

export function PasswordHint({ password, touched }: { password: string; touched: boolean }) {
  const { t } = useTranslation();
  const isError = touched && password.length < 6;
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        marginTop: 10,
        color: isError ? authC.error : '#475569',
      }}
    >
      <Icon
        name="shield"
        size={16}
        color={isError ? authC.error : '#64748B'}
        style={{ marginTop: 2, flexShrink: 0 }}
      />
      <div
        style={{
          font: `400 12.5px/1.45 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
          color: isError ? authC.error : '#475569',
          letterSpacing: 'normal',
        }}
      >
        {t('auth.passwordRule')}
      </div>
    </div>
  );
}
