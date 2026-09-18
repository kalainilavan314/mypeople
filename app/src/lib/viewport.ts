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
    // Without visualViewport there is nothing to measure; the CSS falls back to
    // 100dvh, which is correct on every browser new enough to support it.
    if (!vv) return;

    // --app-h is set ONLY while something is covering the viewport — in
    // practice the on-screen keyboard. The rest of the time the property is
    // removed so plain 100dvh governs the shell.
    //
    // This matters more than it looks. An earlier version tracked the height
    // unconditionally, which meant a stale reading did not merely miss a
    // keyboard, it actively sized the shell wrongly in the normal state: a
    // desktop window left the shell hundreds of pixels taller or shorter than
    // the viewport. Intervening only when there is something to correct makes
    // the worst case a missed shrink rather than a broken layout.
    //
    // A pinch-zoom also shrinks the visual viewport (scale > 1), and resizing
    // the shell then would fight the person doing the zooming.
    const covered = window.innerHeight - vv.height;
    if (vv.scale <= 1.01 && covered > 80) {
      root.style.setProperty('--app-h', `${Math.round(vv.height)}px`);
    } else {
      root.style.removeProperty('--app-h');
    }
  };

  apply();

  // Two independent triggers, because the two cases are genuinely different.
  //
  // visualViewport events cover the keyboard: on iOS the layout viewport does
  // not change at all when the keyboard opens, only the visual one, so nothing
  // observes a box change and only these events fire.
  vv?.addEventListener('resize', apply);
  vv?.addEventListener('scroll', apply);
  window.addEventListener('orientationchange', apply);

  // A ResizeObserver covers everything else. Listening for window 'resize' is
  // not enough: the layout viewport can change without a resize event reaching
  // the page, which left --app-h holding a previous, taller height and the
  // shell overflowing the viewport. Observing the element's own box reacts to
  // the change itself rather than to a notification about it.
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => apply()) : null;
  ro?.observe(root);

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
    ro?.disconnect();
    document.removeEventListener('focusin', onFocusIn);
    root.style.removeProperty('--app-h');
    cleanup = null;
  };
  return cleanup;
}
