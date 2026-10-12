import { Icon, type IconName } from '@/shared/components/Icon';

export function Row({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  onClick: () => void;
  first?: boolean;
}) {
  return (
    <button type="button" className="civic-profile-row" onClick={onClick}>
      <Icon name={icon} size={20} strokeWidth={2} />
      <span>
        <strong>{title}</strong>
        {sub && <small className="sr-only">{sub}</small>}
      </span>
      <Icon name="chevron" size={20} color="var(--icon-muted)" strokeWidth={2} />
    </button>
  );
}
