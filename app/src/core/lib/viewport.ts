let cleanup: (() => void) | null = null;

export function installViewportSizing(): () => void {
  if (cleanup) return cleanup;

  const root = document.documentElement;
  const vv = window.visualViewport;

  const apply = () => {
    if (!vv) return;

    const covered = window.innerHeight - vv.height;
    if (vv.scale <= 1.01 && covered > 80) {
      root.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
    } else {
      root.style.removeProperty('--app-h');
    }
  };

  apply();

  vv?.addEventListener('resize', apply);
  vv?.addEventListener('scroll', apply);
  window.addEventListener('orientationchange', apply);

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => apply()) : null;
  ro?.observe(root);

  const onFocusIn = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null;
    if (!el || !el.matches('input, textarea, select, [contenteditable="true"]')) return;

    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
  };
  document.addEventListener('focusin', onFocusIn);

  cleanup = () => {
    vv?.removeEventListener('resize', apply);
    vv?.removeEventListener('scroll', apply);
    window.removeEventListener('orientationchange', apply);
    ro?.disconnect();
    document.removeEventListener('focusin', onFocusIn);
    root.style.removeProperty('--app-h');
    cleanup = null;
  };
  return cleanup;
}
