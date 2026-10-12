import { authC, font, radius } from '@/core/theme/tokens';
import { Icon, type IconName } from '@/shared/components/Icon';
import { useState } from 'react';

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
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          font: `500 16px/1 ${font.ui}`,
          color: authC.text,
        }}
      />
      {password && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
        >
          <Icon name={show ? 'eyeOff' : 'eye'} size={20} color={authC.text3} strokeWidth={1.9} />
        </button>
      )}
    </div>
  );
}
