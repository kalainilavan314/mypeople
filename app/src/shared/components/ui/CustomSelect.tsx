import { CustomSelectDiv } from '@/shared/components/ui/CustomSelectSections/CustomSelectDiv';
import { CustomSelectOption } from '@/shared/components/uiModel/CustomSelectOption';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  ariaLabel,
  disabled = false,
  style,
}: {
  value: string | null | undefined;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(220);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const nav = document.querySelector('.work-nav');
    const screenEl =
      containerRef.current.closest('.screen') || containerRef.current.closest('.app-shell');

    let bottomLimit = window.innerHeight;
    if (nav) {
      bottomLimit = nav.getBoundingClientRect().top;
    } else if (screenEl) {
      bottomLimit = screenEl.getBoundingClientRect().bottom;
    }

    const topLimit = screenEl ? screenEl.getBoundingClientRect().top : 0;

    const spaceBelow = bottomLimit - rect.bottom;
    const spaceAbove = rect.top - topLimit;

    const neededHeight = Math.min(240, options.length * 44 + 12);

    const shouldOpenUp =
      (spaceBelow < neededHeight + 20 && spaceAbove > 140) ||
      (spaceBelow < 200 && spaceAbove > spaceBelow);

    setOpenUpwards(shouldOpenUp);

    const availableSpace = shouldOpenUp ? spaceAbove - 16 : spaceBelow - 16;
    setMenuMaxHeight(Math.max(120, Math.min(240, availableSpace)));
  };

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      updatePosition();
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, options.length]);

  const selectedOpt = options.find((o) => o.value === value);

  return (
    <CustomSelectDiv
      containerRef={containerRef}
      style={style}
      disabled={disabled}
      toggle={toggle}
      ariaLabel={ariaLabel}
      open={open}
      selectedOpt={selectedOpt}
      placeholder={placeholder}
      openUpwards={openUpwards}
      menuMaxHeight={menuMaxHeight}
      options={options}
      value={value}
      onChange={onChange}
      setOpen={setOpen}
    />
  );
}
