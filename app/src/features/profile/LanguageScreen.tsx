import { useSetLanguage } from '@/core/api/queries';
import type { Lang } from '@/core/api/types';
import { SUPPORTED_LANGS } from '@/core/i18n';
import { c, font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Language() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setLang = useSetLanguage();

  const choose = async (l: Lang) => {
    await setLang.mutateAsync(l);
    await i18n.changeLanguage(l);
    navigate(-1);
  };

  return (
    <div>
      <ScreenHeader titleTa={t('language.title')} titleEn="Choose language" />
      <div style={{ padding: '16px 16px 28px' }}>
        <div
          style={{
            background: c.card,
            border: `1px solid ${c.hairline}`,
            borderRadius: radius.lg,
            overflow: 'hidden',
          }}
        >
          {SUPPORTED_LANGS.map((l, i) => {
            const active = i18n.language === l;
            return (
              <button
                key={l}
                onClick={() => choose(l)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 16px',
                  background: active ? c.maroonTintSoft : 'transparent',
                  border: 'none',
                  borderTop: i ? `1px solid ${c.hairline}` : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ flex: 1, font: `600 16px/1.3 ${font.ta}`, color: c.ink }}>
                  {t(`language.${l}`)}
                </span>
                {l === 'si' && (
                  <span style={{ font: `400 11px/1 ${font.ui}`, color: c.ink3 }}>beta</span>
                )}
                {active && <Icon name="check" size={20} color={c.maroon} strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
        <div style={{ font: `400 12px/1.6 ${font.ui}`, color: c.ink3, marginTop: 14 }}>
          தமிழ் முதன்மை மொழி. Sinhala is in beta — untranslated text falls back to Tamil.
        </div>
      </div>
    </div>
  );
}
