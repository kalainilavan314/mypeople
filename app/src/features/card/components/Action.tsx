import '@/core/theme/membership-card.css';
import { Icon, type IconName } from '@/shared/components/Icon';

export function Action({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className="mp-action"
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={19} />
      <span>{label}</span>
    </button>
  );
}
