import { useBadges, useMember } from '@/core/api/queries';
import { pick } from '@/core/i18n';
import { c, font, radius, tier as tierMap, type Tier } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { QueryBoundary } from '@/shared/components/ui';
import { useTranslation } from 'react-i18next';

const LADDER: Tier[] = ['sprout', 'root', 'palmyra'];

export function Milestones() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const badgesQ = useBadges();
  const memberQ = useMember();

  return (
    <div>
      <ScreenHeader titleTa={t('card.milestones')} titleEn="Milestones" />
      <div style={{ padding: '16px 16px 28px' }}>
        <QueryBoundary query={memberQ}>
          {(member) => (
            <div style={{ display: 'flex', gap: 10 }}>
              {LADDER.map((tk) => {
                const tinfo = tierMap[tk];
                const active = tk === member.tier;
                const locked = LADDER.indexOf(tk) > LADDER.indexOf(member.tier);
                return (
                  <div
                    key={tk}
                    style={{
                      flex: 1,
                      borderRadius: radius.lg,
                      padding: '16px 10px',
                      textAlign: 'center',
                      background: active ? tinfo.soft : c.card,
                      border: `1.5px solid ${active ? tinfo.color : c.hairline}`,
                      opacity: locked ? 0.6 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        background: active ? tinfo.color : c.hairline,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                      }}
                    >
                      <Icon
                        name={locked ? 'lock' : 'sprout'}
                        size={20}
                        color={active ? '#FFFFFF' : c.ink3}
                        strokeWidth={2}
                      />
                    </div>
                    <div style={{ font: `600 13px/1.2 ${font.ta}`, color: c.ink, marginTop: 8 }}>
                      {tinfo.nameTa}
                    </div>
                    <div style={{ font: `400 10px/1 ${font.ui}`, color: c.ink3, marginTop: 2 }}>
                      {tinfo.nameEn}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </QueryBoundary>

        <div style={{ font: `600 14px/1 ${font.ta}`, color: c.ink, margin: '26px 0 14px' }}>
          {t('milestones.badges')}
        </div>
        <QueryBoundary query={badgesQ}>
          {(badges) => (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {badges.map((b) => (
                <div
                  key={b.id}
                  style={{
                    background: c.card,
                    border: `1px solid ${c.hairline}`,
                    borderRadius: radius.md,
                    padding: '16px 8px',
                    textAlign: 'center',
                    opacity: b.earned ? 1 : 0.5,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: b.earned ? c.maroonTint : c.hairline,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                    }}
                  >
                    <Icon
                      name={b.earned ? 'star' : 'lock'}
                      size={20}
                      color={b.earned ? c.maroon : c.ink3}
                      fill={b.earned ? c.maroon : 'none'}
                    />
                  </div>
                  <div style={{ font: `600 11px/1.3 ${font.ta}`, color: c.ink2, marginTop: 8 }}>
                    {pick(lang, b.nameTa, b.nameEn)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}
