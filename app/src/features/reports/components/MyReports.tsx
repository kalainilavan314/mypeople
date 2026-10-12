import { useMyCommunityReports } from '@/core/api/queries';
import { c, font } from '@/core/theme/tokens';
import { ReportItem } from '@/features/reports/components/ReportItem';
import { Icon } from '@/shared/components/Icon';
import { QueryBoundary } from '@/shared/components/ui';
import { useTranslation } from 'react-i18next';
export function MyReports() {
  const { t } = useTranslation();
  const reportsQ = useMyCommunityReports();

  return (
    <div style={{ padding: '8px 0 32px' }}>
      <QueryBoundary query={reportsQ}>
        {(reports) =>
          reports.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <Icon
                name="report"
                size={64}
                color={c.primary}
                strokeWidth={1.4}
                style={{ opacity: 0.35 }}
              />
              <div style={{ font: `600 18px/1.2 ${font.ui}`, color: c.ink, marginTop: 16 }}>
                {t('creport.emptyTitle', 'No Reports Yet')}
              </div>
              <div style={{ font: `400 14px/1.5 ${font.ui}`, color: c.ink3, marginTop: 8 }}>
                {t(
                  'creport.emptyBody',
                  'Your submitted reports and their progress will appear here.',
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {reports.map((r) => (
                <ReportItem key={r.id} report={r} />
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
