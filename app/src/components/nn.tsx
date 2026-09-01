/* ===========================================================================
   NorthNadu primitives — the component anatomy from the design reference.

   Kept separate from ui.tsx (Button/Card/Chip/…) because these are layout
   patterns specific to the NorthNadu home & discovery screens: status badges,
   section headers with a trailing action, gradient action tiles, the teal
   impact strip, pill chip rows and the stories-style avatar row.
=========================================================================== */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { c, font, grad, radius, shadow } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ NetImage
   Remote photo with a graceful fallback. The app is an offline-capable PWA and
   the reference imagery is remote, so a failed/slow load must degrade to a
   themed placeholder rather than a broken-image icon or a blank hole. */
export function NetImage({
  src,
  alt,
  width,
  height,
  radius: r = 0,
  fallbackIcon = 'image',
  fallbackGrad = grad.primary,
  style,
}: {
  src?: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  fallbackIcon?: IconName;
  fallbackGrad?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const box: CSSProperties = {
    width: width ?? '100%',
    height: height ?? '100%',
    borderRadius: r,
    overflow: 'hidden',
    position: 'relative',
    background: c.surfaceVariant,
    flex: 'none',
    ...style,
  };

  if (!src || failed) {
    return (
      <div style={{ ...box, background: fallbackGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }} role="img" aria-label={alt}>
        <Icon name={fallbackIcon} size={22} color="rgba(255,255,255,.85)" strokeWidth={1.6} />
      </div>
    );
  }
  return (
    <div style={box}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          opacity: loaded ? 1 : 0, transition: 'opacity 300ms var(--ease)',
        }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- SectionHead
   "Latest Announcements            View all" */
export function SectionHead({ title, action, onAction, sub }: { title: string; action?: string; onAction?: () => void; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 16px', marginBottom: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: `700 20px/1.25 ${font.head}`, color: c.ink, letterSpacing: '-0.3px' }}>{title}</div>
        {sub && <div style={{ font: `400 13px/1.4 ${font.ui}`, color: c.ink2, marginTop: 2 }}>{sub}</div>}
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{ flex: 'none', background: 'none', border: 'none', padding: '4px 0', font: `600 14px/1 ${font.ui}`, color: c.primary, cursor: 'pointer' }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- StatusBadge
   Small pill used over imagery: Open / Urgent / Culture / New / Featured. */
export type BadgeVariant = 'active' | 'info' | 'warning' | 'completed';

const BADGE: Record<BadgeVariant, { bg: string; fg: string }> = {
  active: { bg: 'var(--primary)', fg: '#FFFFFF' },
  info: { bg: 'var(--tertiary)', fg: '#FFFFFF' },
  warning: { bg: 'var(--secondary)', fg: '#4D2D00' },
  completed: { bg: 'var(--success)', fg: '#FFFFFF' },
};

export function StatusBadge({ label, variant = 'active', showDot = false }: { label: string; variant?: BadgeVariant; showDot?: boolean }) {
  const v = BADGE[variant];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 10px',
        borderRadius: radius.pill, background: v.bg, color: v.fg,
        font: `700 11px/1 ${font.ui}`, letterSpacing: '.2px', whiteSpace: 'nowrap',
      }}
    >
      {showDot && <span style={{ width: 6, height: 6, borderRadius: 999, background: v.fg, opacity: 0.9 }} />}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ ChipRow
   Horizontal pill filter row: selected = filled primary, else outlined. */
export function ChipRow({ items, selected, onSelect }: { items: string[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <div className="nn-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 2px' }}>
      {items.map((label, i) => {
        const on = i === selected;
        return (
          <button
            key={label}
            onClick={() => onSelect(i)}
            style={{
              flex: 'none', height: 40, padding: '0 18px', borderRadius: radius.pill, cursor: 'pointer',
              background: on ? c.primary : 'transparent',
              border: `1.5px solid ${on ? c.primary : c.hairline2}`,
              color: on ? '#fff' : c.ink2,
              font: `600 13px/1 ${font.ui}`,
              transition: 'background 200ms var(--ease), color 200ms var(--ease), border-color 200ms var(--ease)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- QuickTile
   Gradient action tile: 40px icon chip, bold label, muted sublabel. */
export function QuickTile({ icon, label, sublabel, gradient, onClick }: { icon: IconName; label: string; sublabel: string; gradient: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        background: gradient, border: 'none', borderRadius: radius.xl, padding: 16, cursor: 'pointer',
        minHeight: 118, boxSizing: 'border-box', textAlign: 'left',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14,
        boxShadow: shadow.tile,
      }}
    >
      <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color="#fff" strokeWidth={1.9} />
      </span>
      <span>
        <span style={{ display: 'block', font: `700 15px/1.2 ${font.head}`, color: '#fff' }}>{label}</span>
        <span style={{ display: 'block', font: `400 11px/1.35 ${font.ui}`, color: 'rgba(255,255,255,.8)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sublabel}</span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------- ImpactStrip
   Teal gradient card: heading + three stat tiles separated by hairlines. */
export function ImpactStrip({ title, stats }: { title: string; stats: { value: string; label: string; sublabel: string }[] }) {
  return (
    <div style={{ background: grad.primary, borderRadius: radius.xxl, padding: 20, boxShadow: '0 8px 20px -6px rgba(232,168,56,.42)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name="trending" size={18} color="rgba(255,255,255,.9)" strokeWidth={2} />
        <span style={{ font: `700 14px/1 ${font.head}`, color: '#fff', letterSpacing: '.2px' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ flex: 1, display: 'flex', minWidth: 0 }}>
            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <div style={{ font: `800 24px/1 ${font.head}`, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ font: `600 12px/1.25 ${font.ui}`, color: '#fff', marginTop: 4, whiteSpace: 'pre-line' }}>{s.label}</div>
              <div style={{ font: `400 10px/1.3 ${font.ui}`, color: 'rgba(255,255,255,.72)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sublabel}</div>
            </div>
            {i < stats.length - 1 && <span style={{ width: 1, alignSelf: 'center', height: 48, background: 'rgba(255,255,255,.2)', margin: '0 4px' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Bleed
   Lets a horizontally-scrolling row run to the screen edges inside the app's
   padded column, instead of being clipped at 16px. */
export function Bleed({ children }: { children: ReactNode }) {
  return <div className="nn-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 4px' }}>{children}</div>;
}
