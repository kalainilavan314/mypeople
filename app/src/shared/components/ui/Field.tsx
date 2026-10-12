import { c, control, font, radius } from '@/core/theme/tokens';
import type { CSSProperties } from 'react';
import { useId } from 'react';

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
  const describedBy =
    [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  const controlStyle: CSSProperties = {
    height: textarea ? undefined : control.h,
    minHeight: textarea ? 112 : undefined,
    width: '100%',
    borderRadius: radius.sm,
    border: `1px solid ${error ? c.error : 'var(--control-border)'}`,
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
        <span
          id={errId}
          role="alert"
          className="t-caption"
          style={{ color: c.error, fontWeight: 600 }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
