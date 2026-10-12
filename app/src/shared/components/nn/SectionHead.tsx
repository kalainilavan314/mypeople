import { c, font } from '@/core/theme/tokens';

export function SectionHead({
  title,
  action,
  onAction,
  sub,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  sub?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '0 16px',
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ font: `700 20px/1.25 ${font.head}`, color: c.ink, letterSpacing: '-0.3px' }}>
          {title}
        </div>
        {sub && (
          <div style={{ font: `400 13px/1.4 ${font.ui}`, color: c.ink2, marginTop: 2 }}>{sub}</div>
        )}
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            flex: 'none',
            background: 'none',
            border: 'none',
            padding: '4px 0',
            font: `600 14px/1 ${font.ui}`,
            color: c.primary,
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
