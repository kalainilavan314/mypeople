import { Icon, type IconName } from '@/shared/components/Icon';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function ScreenTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="civic-screen-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  pressed,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className="civic-icon-button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span>
        <Icon name={icon} size={20} strokeWidth={2} />
      </span>
    </button>
  );
}

export function DateBadge({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <time
      className="civic-date"
      dateTime={iso}
      aria-label={date.toLocaleDateString('en-GB', { dateStyle: 'full', timeZone: 'Asia/Colombo' })}
    >
      <span>
        {date
          .toLocaleDateString('en-GB', { month: 'short', timeZone: 'Asia/Colombo' })
          .toUpperCase()}
      </span>
      <strong>
        {date.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Colombo' })}
      </strong>
    </time>
  );
}

export function StatusTag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'verified' | 'pending';
}) {
  return (
    <span className={`civic-tag civic-tag--${tone}`}>
      {tone !== 'neutral' && (
        <Icon name={tone === 'verified' ? 'check' : 'clock'} size={12} strokeWidth={2} />
      )}
      {children}
    </span>
  );
}

export function QuickAction({
  to,
  icon,
  label,
  caption,
}: {
  to: string;
  icon: IconName;
  label: string;
  caption: string;
}) {
  return (
    <Link to={to} className="civic-card civic-quick-action">
      <span className="civic-icon-tile">
        <Icon name={icon} size={20} strokeWidth={2} />
      </span>
      <strong>{label}</strong>
      <small>{caption}</small>
    </Link>
  );
}
