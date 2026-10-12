import { usePendingDonations, useReviewDonation } from '@/core/api/queries';
import { c, font } from '@/core/theme/tokens';
import { PendingCard } from '@/features/fundraising/components/PendingCard';
import { Icon } from '@/shared/components/Icon';
import { QueryBoundary } from '@/shared/components/ui';
import { useTranslation } from 'react-i18next';
export function ReviewTab() {
  const { t } = useTranslation();
  const pendingQ = usePendingDonations(true);
  const review = useReviewDonation();

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <QueryBoundary query={pendingQ}>
        {(pending) =>
          pending.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <Icon
                name="checkCircle"
                size={56}
                color={c.success}
                strokeWidth={1.4}
                style={{ opacity: 0.4 }}
              />
              <div style={{ font: `600 16px/1.3 ${font.ta}`, color: c.ink, marginTop: 14 }}>
                {t('fund.reviewEmpty')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pending.map((d) => (
                <PendingCard
                  key={d.id}
                  donation={d}
                  onReview={(action) => review.mutate({ id: d.id, action })}
                  busy={review.isPending}
                />
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
