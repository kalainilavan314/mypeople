import { c, font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { CustomSelectOption } from '@/shared/components/uiModel/CustomSelectOption';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';

type Props = {
  containerRef: import('react').RefObject<HTMLDivElement>;
  style: CSSProperties | undefined;
  disabled: boolean;
  toggle: () => void;
  ariaLabel: string | undefined;
  open: boolean;
  selectedOpt: CustomSelectOption | undefined;
  placeholder: string;
  openUpwards: boolean;
  menuMaxHeight: number;
  options: CustomSelectOption[];
  value: string | null | undefined;
  onChange: (val: string) => void;
  setOpen: Dispatch<SetStateAction<boolean>>;
};
export function CustomSelectDiv({
  containerRef,
  style,
  disabled,
  toggle,
  ariaLabel,
  open,
  selectedOpt,
  placeholder,
  openUpwards,
  menuMaxHeight,
  options,
  value,
  onChange,
  setOpen,
}: Props) {
  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="press"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '13px 14px',
          border: open ? '1.5px solid #14263D' : `1px solid ${c.hairline2}`,
          borderRadius: radius.md,
          background: c.card,
          color: selectedOpt ? c.ink : c.ink3,
          font: `500 14px/1.4 ${font.ta}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          boxShadow: open ? '0 0 0 3px rgba(20, 38, 61, 0.08)' : 'none',
          transition: 'border-color 140ms ease, box-shadow 140ms ease',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginRight: 10,
          }}
        >
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <Icon
          name="chevron"
          size={16}
          color={open ? '#14263D' : c.ink3}
          style={{
            transform: open ? 'rotate(270deg)' : 'rotate(90deg)',
            transition: 'transform 180ms ease',
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            ...(openUpwards ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            left: 0,
            right: 0,
            zIndex: 100,
            background: c.card,
            border: `1.5px solid ${c.hairline2}`,
            borderRadius: radius.md,
            boxShadow: openUpwards
              ? '0 -12px 36px rgba(16, 45, 85, 0.16), 0 -2px 8px rgba(16, 45, 85, 0.06)'
              : '0 12px 36px rgba(16, 45, 85, 0.16), 0 2px 8px rgba(16, 45, 85, 0.06)',
            maxHeight: menuMaxHeight,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: radius.sm,
                  border: 'none',
                  background: isSelected ? 'rgba(20, 38, 61, 0.08)' : 'transparent',
                  color: isSelected ? '#14263D' : c.ink,
                  font: `${isSelected ? '700' : '500'} 13.5px/1.4 ${font.ta}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Icon name="check" size={14} color="#14263D" strokeWidth={2.6} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
