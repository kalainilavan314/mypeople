import '@/core/theme/membership-card.css';
import { Icon, type IconName } from '@/shared/components/Icon';

export function Detail({
  icon,
  label,
  value,
  mono,
}: {
  icon: IconName;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="mp-detail">
      <dt>
        <Icon name={icon} size={16} />
        {label}
      </dt>
      <dd className={mono ? 'mp-mono' : undefined}>{value}</dd>
    </div>
  );
}
