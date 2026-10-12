import { Icon, type IconName } from '@/shared/components/Icon';

export function Row({ icon, title, sub, value, onClick }: {
  icon: IconName;
  title: string;
  sub?: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="profile-account-row" onClick={onClick}>
      <Icon name={icon} size={21} strokeWidth={1.7} />
      <span className="profile-account-label">
        {title}
        {sub && <span className="sr-only"> — {sub}</span>}
      </span>
      {value && <span className="profile-account-value">{value}</span>}
      <Icon name="chevron" size={16} strokeWidth={1.7} />
    </button>
  );
}
