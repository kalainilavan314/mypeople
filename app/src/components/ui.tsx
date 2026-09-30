// Small shared primitives: Button, Chip, Card, Toggle, TierBadge, LabelPair, StatusPill,
// EmptyState, QueryBoundary. Kept together to reduce file sprawl; each is independent.

import type { ReactNode, CSSProperties } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseQueryResult } from '@tanstack/react-query';
import { c, font, ease, radius, shadow, control, tier as tierMap, type Tier } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

/* ---------------------------------------------------------------- Button */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  icon,
  style,
  type = 'button',
  ariaLabel,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: IconName;
  style?: CSSProperties;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}) {
  const base: CSSProperties = {
    height: control.hSm,
    padding: '0 20px',
    borderRadius: radius.sm,
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    font: `600 16px/1 ${font.ui}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: fullWidth ? '100%' : undefined,
    transition: `all ${160}ms ${ease}`,
  };
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: { background: disabled ? c.hairline3 : c.maroon, color: disabled ? c.ink4 : '#FFFFFF', boxShadow: disabled ? 'none' : shadow.card },
    secondary: { background: c.card, color: c.ink0, border: `1px solid ${c.hairline2}` },
    ghost: { background: 'transparent', color: c.maroon },
    success: { background: c.success, color: '#FFFFFF' },
    danger: { background: c.error, color: '#FFFFFF' },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} aria-label={ariaLabel} style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={18} color={variants[variant].color as string} />}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Field */
/* Accessible labelled input/textarea: 56px control, 12px radius, readable
   placeholder, explicit error slot wired via aria-describedby / aria-invalid
   (USWDS-style validation). Placeholder + focus colours live in global.css. */
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  error,
  required = false,
  name,
  inputMode,
  autoComplete,
  textarea = false,
  maxLength,
  disabled = false,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  name?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal' | 'search';
  autoComplete?: string;
  textarea?: boolean;
  maxLength?: number;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  const controlStyle: CSSProperties = {
    height: textarea ? undefined : control.h,
    minHeight: textarea ? 112 : undefined,
    width: '100%',
    borderRadius: radius.sm,
    border: `1px solid ${error ? c.error : c.hairline2}`,
    background: disabled ? c.cardCream : c.card,
    color: c.ink,
    font: `400 16px/1.4 ${font.ui}`,
    padding: textarea ? '14px 16px' : '0 16px',
    outline: 'none',
    boxSizing: 'border-box',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <label htmlFor={id} className="t-label" style={{ color: c.ink2 }}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: c.error }}>
            {' '}
            *
          </span>
        )}
      </label>
      {hint && (
        <span id={hintId} className="t-caption">
          {hint}
        </span>
      )}
      {textarea ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={controlStyle}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          disabled={disabled}
          inputMode={inputMode}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={controlStyle}
        />
      )}
      {error && (
        <span id={errId} role="alert" className="t-caption" style={{ color: c.error, fontWeight: 600 }}>
          {error}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Chip */
export function Chip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: IconName;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 44,
        padding: '0 16px',
        flex: 'none',
        borderRadius: radius.pill,
        cursor: 'pointer',
        border: `1px solid ${active ? c.maroon : c.hairline2}`,
        background: active ? c.maroon : c.card,
        color: active ? '#FFFFFF' : c.ink0,
        font: `600 14px/1 ${font.ta}`,
        transition: `all 160ms ${ease}`,
      }}
    >
      {icon && <Icon name={icon} size={15} color={active ? '#FFFFFF' : c.ink2} />}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ Card */
export function Card({ children, onClick, style, cream = false }: { children: ReactNode; onClick?: () => void; style?: CSSProperties; cream?: boolean }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      style={{
        background: cream ? c.cardCream : c.card,
        border: cream ? 'none' : `1px solid ${c.hairline}`,
        borderRadius: radius.lg,
        boxShadow: cream ? 'none' : shadow.card,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- Toggle */
export function Toggle({ on, onChange, ariaLabel }: { on: boolean; onChange: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      style={{
        width: 48,
        height: 28,
        borderRadius: radius.pill,
        background: on ? c.maroon : c.hairline2,
        padding: 3,
        border: 'none',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        flex: 'none',
        cursor: 'pointer',
        transition: `all 160ms ${ease}`,
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: radius.pill, background: '#FFFFFF', display: 'block' }} />
    </button>
  );
}

/* -------------------------------------------------------------- TierBadge */
export function TierBadge({ tier, onDark = false }: { tier: Tier; onDark?: boolean }) {
  const t = tierMap[tier];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 38,
        padding: '0 13px',
        borderRadius: radius.pill,
        background: onDark ? 'rgba(255,255,255,.16)' : t.soft,
        border: `1px solid ${onDark ? 'rgba(255,255,255,.45)' : t.color}`,
        font: `600 14px/1 ${font.ta}`,
        color: onDark ? '#FFFFFF' : t.color,
      }}
    >
      <Icon name="sprout" size={16} color={onDark ? 'rgba(255,255,255,.9)' : t.color} strokeWidth={2} />
      {t.nameTa} · {t.nameEn}
    </span>
  );
}

/* -------------------------------------------------------------- LabelPair */
export function LabelPair({ ta, en, taSize = 15, enSize = 12, align = 'left' }: { ta: string; en?: string; taSize?: number; enSize?: number; align?: 'left' | 'center' }) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{ font: `600 ${taSize}px/1.3 ${font.ta}`, color: c.ink }}>{ta}</div>
      {en && <div style={{ font: `400 ${enSize}px/1.35 ${font.ui}`, color: c.ink3, marginTop: 2 }}>{en}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- StatusPill */
export function StatusPill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info'; icon?: IconName }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: c.cardCream, fg: c.ink2 },
    success: { bg: c.sproutSoft, fg: c.success },
    warning: { bg: c.warningBg, fg: c.warning },
    error: { bg: c.errorBg, fg: c.error },
    info: { bg: c.maroonTint, fg: c.maroon },
  };
  const s = tones[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: radius.pill, background: s.bg, color: s.fg, font: `600 12px/1 ${font.ui}` }}>
      {icon && <Icon name={icon} size={13} color={s.fg} strokeWidth={2.2} />}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------- EmptyState */
export function EmptyState({ icon = 'report', title, sub }: { icon?: IconName; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: radius.lg, background: c.maroonTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={c.maroon} />
      </div>
      <div style={{ font: `600 16px/1.4 ${font.ta}`, color: c.ink }}>{title}</div>
      {sub && <div style={{ font: `400 13px/1.5 ${font.ui}`, color: c.ink3, maxWidth: 260 }}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------- QueryBoundary */
export function QueryBoundary<T>({ query, children, label }: { query: UseQueryResult<T>; children: (data: T) => ReactNode; label?: string }) {
  const { i18n } = useTranslation();
  const ta = i18n.language === 'ta';
  if (query.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '56px 24px' }}>
        <span className="npm-spinner" style={{ width: 28, height: 28, border: `3px solid ${c.hairline}`, borderTopColor: c.maroon, borderRadius: '50%', display: 'inline-block', animation: 'npmSpin 800ms linear infinite' }} />
        <span style={{ font: `500 13px/1 ${font.ui}`, color: c.ink3 }}>{label ?? 'Loading…'}</span>
        <style>{'@keyframes npmSpin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return <div role="alert" style={{ padding: 24, textAlign: "center" }}><p>{ta ? 'இந்தப் பகுதியை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'Unable to load this section. Please try again.'}</p><button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} style={{ minHeight: 44, padding: "8px 20px", border: `1px solid ${c.hairline}`, borderRadius: 10, color: c.ink, background: c.card, cursor: "pointer" }}>{query.isFetching ? (ta ? 'மீண்டும் முயற்சிக்கிறது…' : 'Retrying…') : (ta ? 'மீண்டும் முயற்சி' : 'Retry')}</button></div>;
  }
  return <>{children(query.data)}</>;
}
