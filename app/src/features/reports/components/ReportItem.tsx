import type { CommunityReport } from '@/core/api/types';
import { c, font, radius, shadow } from '@/core/theme/tokens';
import { STAGES, reportReference } from '@/features/reports/Reports.model';
import { catMeta } from '@/features/reports/Reports.model';
import { fmtDate } from '@/features/reports/Reports.model';
import { statusColor } from '@/features/reports/Reports.model';
import { Icon } from '@/shared/components/Icon';
import { useTranslation } from 'react-i18next';
export function ReportItem({ report }: { report: CommunityReport }) {
  const { t } = useTranslation();
  const meta = catMeta(report.category);
  const tone = statusColor(report.status);
  const stageIndex = STAGES.indexOf(report.status);

  return (
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.hairline}`,
        borderRadius: radius.lg,
        boxShadow: shadow.card,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: meta.bg,
            color: meta.color,
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }}
        >
          <Icon name={meta.icon} size={20} strokeWidth={2} />
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            font: `700 15px/1.35 ${font.ui}`,
            color: c.ink,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {report.title}
        </span>
        <span
          style={{
            flex: 'none',
            font: `600 11px/1 ${font.ui}`,
            color: tone,
            background: `color-mix(in srgb, ${tone} 12%, transparent)`,
            padding: '5px 10px',
            borderRadius: 8,
          }}
        >
          {t(`creport.status.${report.status}`, report.status)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
        <Icon name="mapPin" size={13} color={c.ink3} strokeWidth={2.2} />
        <span style={{ font: `400 12px/1 ${font.ui}`, color: c.ink3 }}>
          {report.districtName ?? '—'}
        </span>
        <span style={{ flex: 1 }} />
        <Icon name="calendar" size={12} color={c.ink3} strokeWidth={2.2} />
        <span style={{ font: `400 12px/1 ${font.ui}`, color: c.ink3 }}>
          {fmtDate(report.createdAt)}
        </span>
      </div>
      <div style={{ marginTop: 6, font: `500 12px/1.4 ${font.mono}`, color: c.ink3 }}>
        {reportReference(report.id)}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 14 }}>
        {STAGES.map((s, i) => {
          const done = i <= stageIndex;
          const current = i === stageIndex;
          return (
            <div
              key={s}
              style={{
                display: 'flex',
                flex: i < STAGES.length - 1 ? 1 : 'none',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 54,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    boxSizing: 'border-box',
                    background: done ? c.primary : c.hairline2,
                    border: current ? `2px solid ${c.primary}` : 'none',
                    boxShadow: current
                      ? `0 0 0 2px ${c.card}, 0 0 0 3.5px var(--maroon-tint-border)`
                      : 'none',
                  }}
                />
                <span
                  style={{
                    font: `${current ? 700 : 400} 9px/1.25 ${font.ui}`,
                    color: done ? c.primary : c.ink4,
                    marginTop: 4,
                    textAlign: 'center',
                  }}
                >
                  {t(`creport.status.${s}`, s)}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span
                  style={{
                    flex: 1,
                    height: 2,
                    background: i < stageIndex ? c.primary : c.hairline2,
                    marginTop: 4,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
