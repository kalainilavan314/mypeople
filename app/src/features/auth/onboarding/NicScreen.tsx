import { api } from '@/core/api';
import { c, font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Button } from '@/shared/components/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Nic() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [front, setFront] = useState(false);
  const [back, setBack] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const ready = front && back && consent;

  const submit = async () => {
    setSubmitting(true);
    await api.submitNic();
    setSubmitting(false);
    navigate('/welcome/pending');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <ScreenHeader
        titleTa={t('onboarding.nicTitle')}
        titleEn="Verify identity"
        onBack={() => navigate('/welcome/otp')}
      />
      <div style={{ flex: 1, padding: '20px 24px' }}>
        <div style={{ font: `400 14px/1.5 ${font.ui}`, color: c.ink2 }}>
          {t('onboarding.nicSubtitle')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          <UploadTile
            label={t('onboarding.nicFront')}
            done={front}
            onClick={() => setFront(true)}
          />
          <UploadTile label={t('onboarding.nicBack')} done={back} onClick={() => setBack(true)} />
        </div>

        <button
          onClick={() => setConsent((v) => !v)}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            marginTop: 20,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              flex: 'none',
              border: `2px solid ${consent ? c.maroon : '#C9C4B5'}`,
              background: consent ? c.maroon : c.card,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {consent && <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.6} />}
          </span>
          <span style={{ font: `400 13px/1.6 ${font.ta}`, color: c.ink2 }}>
            {t('onboarding.nicConsent')}
          </span>
        </button>

        <div style={{ marginTop: 26 }}>
          <Button fullWidth disabled={!ready || submitting} onClick={submit}>
            {submitting ? t('common.loading') : t('onboarding.nicSubmit')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UploadTile({
  label,
  done,
  onClick,
}: {
  label: string;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        height: 72,
        padding: '0 16px',
        borderRadius: radius.md,
        border: `1.5px ${done ? 'solid' : 'dashed'} ${done ? c.maroon : c.hairline2}`,
        background: done ? c.maroonTintSoft : c.card,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: done ? c.maroon : c.maroonTint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <Icon
          name={done ? 'check' : 'camera'}
          size={20}
          color={done ? '#FFFFFF' : c.maroon}
          strokeWidth={done ? 2.4 : 1.9}
        />
      </span>
      <span style={{ flex: 1, font: `600 14px/1.3 ${font.ta}`, color: c.ink }}>{label}</span>
      {!done && <span style={{ font: `500 12px/1 ${font.ui}`, color: c.maroon }}>Add</span>}
    </button>
  );
}
