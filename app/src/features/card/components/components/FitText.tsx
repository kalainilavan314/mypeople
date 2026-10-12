import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-tamil/900.css';
import { useLayoutEffect, useRef } from 'react';

export function FitText({
  children,
  max = 22,
  min = 14,
  className = '',
}: {
  children: string;
  max?: number;
  min?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      let size = max;
      el.style.fontSize = size + 'px';
      while (
        size > min &&
        (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
      ) {
        size--;
        el.style.fontSize = size + 'px';
      }
    };
    fit();
    void document.fonts.ready.then(fit);
    return () => {
      disposed = true;
    };
  }, [children, max, min]);
  return (
    <div ref={ref} className={'credential-fit ' + className} style={{ fontSize: max }}>
      {children || '—'}
    </div>
  );
}
