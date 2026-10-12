import { useTranslation } from 'react-i18next';
import { Icon } from '@/shared/components/Icon';
export function ProfileSetupContinue({ onContinue, disabled }: { onContinue: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  return <div style={{ marginTop: 8 }}>
    <button type="button" className="profile-cta-btn" onClick={onContinue} disabled={disabled}>
      <span>{t('common.next')}</span>
      <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.4} />
    </button>
  </div>;
}
