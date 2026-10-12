import { setSavedLang } from '@/core/i18n';
import { authC, font, radius } from '@/core/theme/tokens';
import { useTranslation } from 'react-i18next';

export function LangToggle() {
  const { i18n } = useTranslation();
  const active = i18n.language === 'ta' ? 'ta' : 'en';
  const LABEL: Record<'ta' | 'en', string> = { ta: 'தமிழ்', en: 'English' };
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: radius.pill,
        background: authC.surface2,
        border: `1px solid ${authC.line}`,
      }}
    >
      {(['ta', 'en'] as const).map((l) => {
        const on = active === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setSavedLang(l)}
            aria-pressed={on}
            style={{
              height: 30,
              padding: '0 12px',
              borderRadius: radius.pill,
              cursor: 'pointer',
              border: 'none',
              background: on ? authC.green : 'transparent',
              color: on ? authC.onGreen : authC.text2,
              font: `600 12.5px/1 ${l === 'ta' ? font.ta : font.ui}`,
              transition: 'background 180ms ease, color 180ms ease',
            }}
          >
            {LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
