import { useDonationBoard, useMyDonations } from '@/core/api/queries';
import { c, font, radius, shadow } from '@/core/theme/tokens';
import { StatusChip } from '@/features/fundraising/components/StatusChip';
import { fmtDate } from '@/features/fundraising/PartyFund.model';
import { fmtLKR } from '@/features/fundraising/PartyFund.model';
import { GOLD } from '@/features/fundraising/PartyFund.model';
import { Icon } from '@/shared/components/Icon';
import { QueryBoundary } from '@/shared/components/ui';
import { useTranslation } from 'react-i18next';
export function DonorsTab() {
  const { t } = useTranslation();
  const boardQ = useDonationBoard();
  const mineQ = useMyDonations();

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <QueryBoundary query={mineQ}>
        {(mine) =>
          mine.length ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ font: `700 14px/1.2 ${font.ta}`, color: c.ink2, marginBottom: 10 }}>
                {t('fund.yours')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mine.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: c.card,
                      border: `1px solid ${c.hairline}`,
                      borderRadius: radius.md,
                      padding: '11px 14px',
                    }}
                  >
                    <span style={{ fontSize: 17, lineHeight: 1 }}>
                      {d.method === 'card' ? '💳' : '🧾'}
                    </span>
                    <span style={{ flex: 1, font: `600 13.5px/1.3 ${font.ui}`, color: c.ink }}>
                      {fmtLKR(d.amount)}
                    </span>
                    <span style={{ font: `400 11.5px/1 ${font.ui}`, color: c.ink3 }}>
                      {fmtDate(d.createdAt)}
                    </span>
                    <StatusChip status={d.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : null
        }
      </QueryBoundary>

      <div style={{ font: `700 14px/1.2 ${font.ta}`, color: c.ink2, marginBottom: 10 }}>
        {t('fund.allDonors')}
      </div>
      <QueryBoundary query={boardQ}>
        {(board) =>
          board.donations.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <Icon
                name="heart"
                size={56}
                color={c.primary}
                strokeWidth={1.4}
                style={{ opacity: 0.35 }}
              />
              <div style={{ font: `600 16px/1.3 ${font.ta}`, color: c.ink, marginTop: 14 }}>
                {t('fund.emptyTitle')}
              </div>
              <div style={{ font: `400 13px/1.5 ${font.ta}`, color: c.ink2, marginTop: 6 }}>
                {t('fund.emptyBody')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {board.donations.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: c.card,
                    border: `1px solid ${c.hairline}`,
                    borderRadius: radius.lg,
                    boxShadow: shadow.card,
                    padding: '13px 16px',
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: `${GOLD}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      font: `700 15px/1 ${font.head}`,
                      color: c.primary,
                    }}
                  >
                    {(d.donorName ?? '?').charAt(0).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        font: `700 14px/1.25 ${font.ta}`,
                        color: c.ink,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.donorName}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        font: `400 11.5px/1.3 ${font.ui}`,
                        color: c.ink3,
                        marginTop: 2,
                      }}
                    >
                      {d.districtName ? `${d.districtName} · ` : ''}
                      {fmtDate(d.createdAt)} · {d.method === 'card' ? '💳' : '🧾'}
                    </span>
                  </span>
                  <span style={{ flex: 'none', font: `800 15px/1 ${font.head}`, color: c.primary }}>
                    {fmtLKR(d.amount)}
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
