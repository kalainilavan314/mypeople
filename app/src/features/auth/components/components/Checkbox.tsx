import { authC, font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
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
