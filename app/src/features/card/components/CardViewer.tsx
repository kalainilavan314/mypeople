import '@/core/theme/membership-card.css';
import { Text } from '@/features/card/Card.model';
import { Close } from '@/features/card/components/Close';
import {
  ScaledMembershipCredential,
  type MembershipCredentialData,
} from '@/features/card/components/MembershipCredential';
import { useEffect, useRef, useState } from 'react';
export function CardViewer({
  data,
  onClose,
  t,
}: {
  data: MembershipCredentialData;
  onClose: () => void;
  t: Text;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.8),
    [fit, setFit] = useState(700);
  const points = useRef(new Map<number, { x: number; y: number }>()),
    gesture = useRef({ distance: 0, zoom: 1 });
  useEffect(() => {
    dialog.current?.showModal();
    const el = viewport.current;
    if (!el) return;
    const measure = () => setFit(Math.max(100, el.clientWidth - 24));
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const applyZoom = (value: number, x?: number, y?: number) => {
    const el = viewport.current;
    if (!el) return;
    const next = Math.min(4, Math.max(0.5, value)),
      r = el.getBoundingClientRect(),
      ax = x === undefined ? el.clientWidth / 2 : x - r.left,
      ay = y === undefined ? el.clientHeight / 2 : y - r.top;
    const cx = (el.scrollLeft + ax) / zoom,
      cy = (el.scrollTop + ay) / zoom;
    setZoom(next);
    requestAnimationFrame(() => {
      el.scrollLeft = cx * next - ax;
      el.scrollTop = cy * next - ay;
    });
  };
  return (
    <dialog
      ref={dialog}
      className="mp-dialog"
      aria-labelledby="card-view-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="mp-dialog-header">
        <h2 id="card-view-title">{t('Your membership card', 'உங்கள் உறுப்பினர் அட்டை')}</h2>
        <Close t={t} onClose={onClose} />
      </div>
      <div className="mp-zoom-toolbar">
        <button
          type="button"
          aria-label={t('Zoom out', 'சிறிதாக்கு')}
          onClick={() => applyZoom(zoom - 0.25)}
          disabled={zoom <= 0.5}
        >
          −
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          aria-label={t('Zoom in', 'பெரிதாக்கு')}
          onClick={() => applyZoom(zoom + 0.25)}
          disabled={zoom >= 4}
        >
          +
        </button>
        <button type="button" onClick={() => applyZoom(1)}>
          {t('Fit', 'முழு அட்டை')}
        </button>
        <span>{t('Drag or pinch to explore', 'இழுத்து அல்லது விரல்களால் பெரிதாக்கிப் பார்')}</span>
      </div>
      <div
        ref={viewport}
        className="mp-viewer-viewport"
        tabIndex={0}
        role="region"
        aria-label={t('Zoomable membership card', 'பெரிதாக்கக்கூடிய உறுப்பினர் அட்டை')}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (points.current.size === 2) {
            const [a, b] = [...points.current.values()];
            gesture.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
          }
        }}
        onPointerMove={(e) => {
          const previous = points.current.get(e.pointerId);
          if (!previous) return;
          points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (points.current.size === 2) {
            const [a, b] = [...points.current.values()];
            applyZoom(
              (gesture.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
                Math.max(1, gesture.current.distance),
              (a.x + b.x) / 2,
              (a.y + b.y) / 2,
            );
          } else {
            e.currentTarget.scrollLeft -= e.clientX - previous.x;
            e.currentTarget.scrollTop -= e.clientY - previous.y;
          }
        }}
        onPointerUp={(e) => points.current.delete(e.pointerId)}
        onPointerCancel={(e) => points.current.delete(e.pointerId)}
      >
        <div className="mp-viewer-inner" style={{ width: fit * zoom }}>
          <ScaledMembershipCredential data={data} />
        </div>
      </div>
      <p className="mp-note">
        {t(
          'Your membership details remain readable below the card on the main page.',
          'முதன்மைப் பக்கத்தில் அட்டைக்குக் கீழுள்ள உறுப்பினர் விவரங்களை எளிதாகப் படிக்கலாம்.',
        )}
      </p>
    </dialog>
  );
}
