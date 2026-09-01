import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { QueryBoundary, StatusPill } from '../components/ui';
import { useReport } from '../data/queries';

export function ReportDetail() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const reportQ = useReport(id);

  return (
    <div>
      <ScreenHeader titleTa="அறிக்கை விவரம்" titleEn="Report detail" />
      <QueryBoundary query={reportQ}>
        {(r) =>
          r ? (
            <div style={{ padding: '16px 16px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: `500 12px/1 ${font.mono}`, color: c.ink3 }}>{r.code}</span>
                <StatusPill label={t(`reports.status.${r.status}`)} tone={r.status === 'actioned' ? 'success' : r.status === 'under_review' ? 'info' : 'neutral'} />
              </div>
              <h1 style={{ font: `700 19px/1.4 ${font.ta}`, color: c.ink, margin: '10px 0 0' }}>{r.titleTa}</h1>
              <p style={{ font: `400 14px/1.7 ${font.ta}`, color: c.ink2 }}>{r.bodyTa}</p>

              {/* Voice note */}
              {r.audioUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: c.cardCream, borderRadius: radius.md, padding: 14, marginTop: 4 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 999, background: c.maroon, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="mic" size={18} color="#FFFFFF" />
                  </span>
                  <div style={{ flex: 1, height: 4, borderRadius: 999, background: c.hairline2 }}><div style={{ width: '35%', height: '100%', borderRadius: 999, background: c.maroon }} /></div>
                  <span style={{ font: `500 12px/1 ${font.mono}`, color: c.ink3 }}>0:34</span>
                </div>
              )}

              {/* GPS chip */}
              {r.lat && (
                <div style={{ marginTop: 14 }}>
                  <StatusPill label={`${r.lat.toFixed(4)}, ${r.lng?.toFixed(4)}`} tone="neutral" icon="mapPin" />
                </div>
              )}

              {/* Timeline */}
              <div style={{ font: `600 14px/1 ${font.ta}`, color: c.ink, margin: '24px 0 14px' }}>நிலை · Status</div>
              <div>
                {r.timeline.map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ width: 14, height: 14, borderRadius: 999, background: c.maroon, marginTop: 3 }} />
                      {i < r.timeline.length - 1 && <span style={{ flex: 1, width: 2, background: c.hairline }} />}
                    </div>
                    <div style={{ paddingBottom: 18 }}>
                      <div style={{ font: `600 14px/1.3 ${font.ta}`, color: c.ink }}>{t(`reports.status.${e.status}`)}</div>
                      {e.note && <div style={{ font: `400 13px/1.5 ${font.ta}`, color: c.ink2, marginTop: 3 }}>{e.note}</div>}
                      <div style={{ font: `400 11px/1 ${font.ui}`, color: c.ink3, marginTop: 4 }}>{e.actorName ? `${e.actorName} · ` : ''}{new Date(e.createdAt).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 24 }}>{t('common.empty')}</div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
