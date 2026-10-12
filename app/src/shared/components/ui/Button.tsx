import { c, control, ease, font, radius, shadow } from '@/core/theme/tokens';
import { Icon, type IconName } from '@/shared/components/Icon';
import { ButtonVariant } from '@/shared/components/uiModel/ButtonVariant';
import type { CSSProperties, ReactNode } from 'react';
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
    primary: {
      background: disabled ? c.hairline3 : c.maroon,
      color: disabled ? c.ink4 : '#FFFFFF',
      boxShadow: disabled ? 'none' : shadow.card,
    },
    secondary: { background: c.card, color: c.ink0, border: `1px solid ${c.hairline2}` },
    ghost: { background: 'transparent', color: c.maroon },
    success: { background: 'var(--success-text)', color: c.onPrimary },
    danger: { background: c.error, color: '#FFFFFF' },
  };
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {icon && <Icon name={icon} size={18} color={variants[variant].color as string} />}
      {children}
    </button>
  );
}
