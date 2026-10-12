import { font, grad, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';

export function ImpactStrip({
  title,
  stats,
}: {
  title: string;
  stats: { value: string; label: string; sublabel: string }[];
}) {
  return (
    <div
      style={{
        background: grad.primary,
        borderRadius: radius.xxl,
        padding: 20,
        boxShadow: '0 8px 20px -6px rgba(20,38,61,.42)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name="trending" size={18} color="rgba(255,255,255,.9)" strokeWidth={2} />
        <span style={{ font: `700 14px/1 ${font.head}`, color: '#fff', letterSpacing: '.2px' }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ flex: 1, display: 'flex', minWidth: 0 }}>
            <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <div
                style={{
                  font: `800 24px/1 ${font.head}`,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  font: `600 12px/1.25 ${font.ui}`,
                  color: '#fff',
                  marginTop: 4,
                  whiteSpace: 'pre-line',
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  font: `400 10px/1.3 ${font.ui}`,
                  color: 'rgba(255,255,255,.72)',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s.sublabel}
              </div>
            </div>
            {i < stats.length - 1 && (
              <span
                style={{
                  width: 1,
                  alignSelf: 'center',
                  height: 48,
                  background: 'rgba(255,255,255,.2)',
                  margin: '0 4px',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
