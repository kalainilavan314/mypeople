import { Icon } from '@/shared/components/Icon';
import { useTranslation } from 'react-i18next';
export function ProfileSetupIntroduction() {
  const { t } = useTranslation();
  return (
    <div style={{ marginTop: 2, marginBottom: 4 }}>
      <h2
        style={{
          font: `900 22px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
          color: '#14263D',
          margin: 0,
          letterSpacing: 'normal',
          maxWidth: 320,
        }}
      >
        {t('profileSetup.heroTitle', 'நம்மை பற்றி கொஞ்சம் மேலும் கூறுங்கள்')}
      </h2>
      <p
        style={{
          font: `500 13.5px/1.55 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
          color: '#475569',
          margin: '6px 0 0',
          letterSpacing: 'normal',
        }}
      >
        {t('profileSetup.heroSub', 'உங்கள் சமூக இணைப்பிற்கான விவரங்களை நிரப்புங்கள்.')}
      </p>
    </div>
  );
}
export function ProfileSetupPrivacyNote() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 12px 14px',
      }}
    >
      <Icon name="info" size={16} color="#64748B" style={{ flexShrink: 0 }} />
      <div
        style={{
          font: `500 13px/1.5 var(--font-ui)`,
          color: '#475569',
          textAlign: 'center',
        }}
      >
        {t('profileSetup.dataUse')}
      </div>
    </div>
  );
}
