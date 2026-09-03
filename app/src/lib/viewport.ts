/**
 * Keeps the app shell sized to the space the on-screen keyboard leaves behind,
 * and keeps the focused field visible above it.
 *
 * The shell is a fixed-height, overflow:hidden column (see styles/global.css).
 * That is what makes the bottom nav sit still instead of drifting with page
 * scroll — but it means the shell must actually shrink when the keyboard opens,
 * or the focused input ends up underneath it and the field appears dead.
 *
 * Two mechanisms, because no single one covers both platforms:
 *
 *  - Chrome/Android honours `interactive-widget=resizes-content` in the viewport
 *    meta (see index.html), which shrinks the layout viewport, so `100dvh` is
 *    already correct there and `--app-h` simply tracks it.
 *  - iOS Safari ignores that property. It only shrinks the *visual* viewport, so
 *    the height has to be read from `window.visualViewport` and applied
 *    manually.
 *
 * Both paths converge on the same CSS variable, so global.css has one rule.
 */

let cleanup: (() => void) | null = null;

export function installViewportSizing(): () => void {
  // Idempotent: React StrictMode mounts effects twice in development.
  if (cleanup) return cleanup;

  const root = document.documentElement;
  const vv = window.visualViewport;

  const apply = () => {
    // Without visualViewport, leave --app-h unset so the CSS falls back to
    // 100dvh, which is correct on every browser new enough to support it.
    if (!vv) return;
    // On iOS the visual viewport also shrinks while pinch-zoomed; scale > 1
    // means the user zoomed rather than the keyboard opening, and resizing the
    // shell then would fight them.
    const height = vv.scale > 1.01 ? window.innerHeight : vv.height;
    root.style.setProperty('--app-h', `${Math.round(height)}px`);
  };

  apply();
  vv?.addEventListener('resize', apply);
  vv?.addEventListener('scroll', apply);
  window.addEventListener('orientationchange', apply);

  // Bring the focused field into view once the keyboard animation has settled.
  // `scroll-margin-block` in global.css reserves the space above and below, so
  // the label stays visible rather than the field hugging the keyboard edge.
  const onFocusIn = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null;
    if (!el || !el.matches('input, textarea, select, [contenteditable="true"]')) return;
    // Two frames plus a beat: the keyboard is still animating on the first.
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
  };
  document.addEventListener('focusin', onFocusIn);

  cleanup = () => {
    vv?.removeEventListener('resize', apply);
    vv?.removeEventListener('scroll', apply);
    window.removeEventListener('orientationchange', apply);
    document.removeEventListener('focusin', onFocusIn);
    root.style.removeProperty('--app-h');
    cleanup = null;
  };
  return cleanup;
}
