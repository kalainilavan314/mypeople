// Shared building blocks for the NorthNadu auth screens (always light).
// Self-contained inline styling using the authC / green tokens — `green*` keys
// hold the deep-teal palette.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/Logo';
import { authC, font, radius } from '../../theme/tokens';
import { setSavedLang } from '../../i18n';
import { Icon, type IconName } from '../../components/Icon';

/* ---------------------------------------------------------------- AuthPage */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', background: authC.bg, color: authC.text, display: 'flex', flexDirection: 'column' }}>
      {/* Dark-theme input placeholder + autofill fixes */}
      <style>{`
        .auth input::placeholder { color: ${authC.text3}; opacity: 1; }
        .auth input:-webkit-autofill,
        .auth input:-webkit-autofill:focus {
          -webkit-text-fill-color: ${authC.text};
          -webkit-box-shadow: 0 0 0 60px ${authC.field} inset;
          caret-color: ${authC.text};
        }
      `}</style>
      <div className="auth" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%' }}>
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- HeroBackground */
// Full-screen cinematic hero for the Login screen. Drop a photo at
// /public/login-hero.jpg to replace the default golden-hour scene. A 50–85%
// dark overlay fades into the navy page so text/glass card stay legible.
function PalmSilhouette({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 140" width="70" height="98" style={style} aria-hidden="true">
      <path d="M49 140 L47 60 Q46 52 50 50 Q54 52 53 60 L51 140 Z" fill="#0B1020" />
      <g fill="#0B1020">
        <path d="M50 50 Q30 40 8 44 Q30 46 50 54 Z" />
        <path d="M50 50 Q70 40 92 44 Q70 46 50 54 Z" />
        <path d="M50 50 Q34 30 18 22 Q36 34 50 52 Z" />
        <path d="M50 50 Q66 30 82 22 Q64 34 50 52 Z" />
        <path d="M50 50 Q48 28 44 12 Q52 30 52 50 Z" />
        <path d="M50 50 Q52 28 56 12 Q48 30 48 50 Z" />
      </g>
    </svg>
  );
}

// Top image panel: the photo sits at the TOP and stays clearly visible; the
// login fields render below it. A soft gradient fades the photo's lower edge
// into the navy page, and children (e.g. "Welcome Back") overlay the bottom.
export function HeroPanel({ height = '46vh', children }: { height?: number | string; children?: ReactNode }) {
  const [imgOk, setImgOk] = useState(true);
  const base = import.meta.env.BASE_URL || '/';
  return (
    <div style={{ position: 'relative', height, minHeight: 300, maxHeight: 460, flex: 'none', overflow: 'hidden' }}>
      {/* Default golden-hour scene (only visible if no photo is present) */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #F6BE72 0%, #E39457 22%, #B06A55 44%, #5C4A63 66%, #22284A 88%, #0B1020 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 34% at 72% 18%, rgba(255,214,150,.5), transparent 62%)' }} />
      <PalmSilhouette style={{ position: 'absolute', left: 20, bottom: '30%' }} />
      <PalmSilhouette style={{ position: 'absolute', left: 74, bottom: '32%', transform: 'scale(.8)' }} />
      <PalmSilhouette style={{ position: 'absolute', right: 26, bottom: '29%', transform: 'scaleX(-1)' }} />

      {/* User photo (optional) — kept fully visible, faces favoured */}
      <img
        src={`${base}login-hero.png`}
        alt=""
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.dataset.triedJpg) {
            img.dataset.triedJpg = '1';
            img.src = `${base}login-hero.jpg`;
          } else {
            setImgOk(false);
          }
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 28%', display: imgOk ? 'block' : 'none' }}
      />

      {/* Scrim for legible text over the photo (clean edge to the form below) */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: 'linear-gradient(to top, rgba(15,22,38,.62) 0%, rgba(15,22,38,.28) 40%, transparent 100%)' }} />
      {children && <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- Field */
export function Field({
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  autoCapitalize,
  maxLength,
  password = false,
  error,
  ariaLabel,
}: {
  icon: IconName;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'numeric' | 'email';
  autoCapitalize?: 'none' | 'words' | 'characters';
  maxLength?: number;
  password?: boolean;
  error?: boolean;
  ariaLabel?: string;
}) {
  const [show, setShow] = useState(false);
  const border = error ? authC.error : authC.fieldBorder;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 56,
        padding: '0 16px',
        borderRadius: radius.md,
        background: authC.field,
        border: `1.5px solid ${border}`,
      }}
    >
      <Icon name={icon} size={20} color={authC.text3} strokeWidth={1.9} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={password && !show ? 'password' : type}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        aria-label={ariaLabel}
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: `500 16px/1 ${font.ui}`, color: authC.text }}
      />
      {password && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <Icon name={show ? 'eyeOff' : 'eye'} size={20} color={authC.text3} strokeWidth={1.9} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- FieldLabel */
export function FieldLabel({ ta }: { ta: string; en?: string }) {
  // `ta` is already the current language's translated label (despite the prop
  // name) — show only it. A hardcoded `en` fallback used to be appended after
  // a slash regardless of the selected language, so Tamil mode always showed
  // both languages while English mode only looked right by coincidence.
  return (
    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#1E293B' }}>{ta}</span>
    </div>
  );
}

/* ------------------------------------------------------------- GreenButton */
export function GreenButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: CSSProperties;
}) {
  const off = disabled || loading;
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      disabled={off}
      style={{
        width: '100%',
        height: 52,
        borderRadius: radius.pill,
        border: 'none',
        background: off ? '#94A3B8' : '#14263D',
        color: '#ffffff',
        font: `700 15.5px/1 var(--font-ui, sans-serif)`,
        letterSpacing: 'normal',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: off ? 'not-allowed' : 'pointer',
        boxShadow: off ? 'none' : '0 10px 24px -4px rgba(20, 38, 61, 0.42)',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        ...style,
      }}
    >
      {loading && (
        <span
          className="auth-spin"
          style={{
            width: 18,
            height: 18,
            border: '2.5px solid rgba(255,255,255,.4)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'authSpin 700ms linear infinite',
          }}
        />
      )}
      {children}
      <style>{'@keyframes authSpin{to{transform:rotate(360deg)}}'}</style>
    </button>
  );
}

/* ---------------------------------------------------------------- Checkbox */
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `2px solid ${checked ? authC.green : authC.text3}`,
          background: checked ? authC.green : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
          transition: 'all 160ms',
        }}
      >
        {checked && <Icon name="check" size={13} color={authC.bg} strokeWidth={3} />}
      </span>
      <span style={{ font: `500 13px/1 ${font.ui}`, color: authC.text2 }}>{label}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- LinkText */
export function LinkText({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, font: `600 13px/1.4 ${font.ui}`, color: authC.green }}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Steps */
export function Steps({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: active ? '#14263D' : done ? '#2563EB' : '#E2E8F0',
                color: active || done ? '#ffffff' : '#64748B',
                font: '700 11px/22px var(--font-ui, sans-serif)',
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                transition: 'all 200ms ease',
              }}
            >
              {i + 1}
            </span>
            {i < total - 1 && (
              <span
                style={{
                  width: 14,
                  height: 1.5,
                  background: done ? '#2563EB' : '#E2E8F0',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- BackChip */
/* ------------------------------------------------------------------ LogoBars
   Kept under its original name so callers do not change. It now renders the
   organisation mark itself rather than the five abstract bars, which were a
   placeholder from the design reference and had no relation to the real logo. */
export function LogoBars({ height = 28 }: { height?: number }) {
  return <Logo size={height} />;
}

/* ------------------------------------------------------------------ Wordmark
   The organisation name, Tamil first with the English beneath — the same pairing
   used on the business card and throughout the app. Reads from i18n so it is
   never hard-coded in two places. */
export function Wordmark({ size = 30 }: { size?: number }) {
  const { t } = useTranslation();
  return (
    <div>
      <div style={{ font: `800 ${size}px/1.1 ${font.ta}`, letterSpacing: '-0.3px', color: authC.text }}>
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

/* ---------------------------------------------------------------- LangToggle
   Language chosen *before* signing in, so the whole flow (including the joining
   survey) renders in the member's language. Persisted so it survives a reload
   and is sent to the backend as the member's `language` on sign-up. */
export function LangToggle() {
  const { i18n } = useTranslation();
  const active = i18n.language === 'ta' ? 'ta' : 'en';
  const LABEL: Record<'ta' | 'en', string> = { ta: 'தமிழ்', en: 'English' };
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: radius.pill, background: authC.surface2, border: `1px solid ${authC.line}` }}>
      {(['ta', 'en'] as const).map((l) => {
        const on = active === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setSavedLang(l)}
            aria-pressed={on}
            style={{
              height: 30, padding: '0 12px', borderRadius: radius.pill, cursor: 'pointer', border: 'none',
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

/* ------------------------------------------------------------------- SegTabs
   Login / Create Account segmented control (selected = raised white pill). */
export function SegTabs({ tabs, active, onSelect }: { tabs: { key: string; label: string }[]; active: string; onSelect: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 5, borderRadius: radius.md, background: authC.surface2 }}>
      {tabs.map((tb) => {
        const on = tb.key === active;
        return (
          <button
            key={tb.key}
            type="button"
            onClick={() => onSelect(tb.key)}
            aria-pressed={on}
            style={{
              flex: 1, height: 44, borderRadius: radius.sm, cursor: 'pointer', border: 'none',
              background: on ? authC.surface : 'transparent',
              color: on ? authC.green : authC.text2,
              font: `700 15px/1 ${font.ui}`,
              boxShadow: on ? '0 2px 8px rgba(20,38,61,.18)' : 'none',
              transition: 'background 180ms ease, color 180ms ease',
            }}
          >
            {tb.label}
          </button>
        );
      })}
    </div>
  );
}

export function BackChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      style={{ width: 44, height: 44, borderRadius: radius.pill, border: `1px solid ${authC.line}`, background: authC.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(35,55,80,.06)' }}
    >
      <Icon name="chevronLeft" size={22} color={authC.text} strokeWidth={2} />
    </button>
  );
}
