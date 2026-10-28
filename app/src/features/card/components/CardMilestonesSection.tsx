import type { ServerMember } from '@/core/api/auth/models';
import { useBadges } from '@/core/api/queries';
import '@/core/theme/membership-card.css';
import { Icon } from '@/shared/components/Icon';
import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { QueryBoundary } from '@/shared/components/ui';
import { useNavigate } from 'react-router-dom';

type Props = {
  t: ReturnType<typeof useWorkspaceText>;
  navigate: ReturnType<typeof useNavigate>;
  badgesQ: ReturnType<typeof useBadges>;
  me: ServerMember;
};
export function CardMilestonesSection({ t, navigate, badgesQ, me }: Props) {
  return (
    <section className="mp-section">
      <div className="mp-section-heading">
        <h2>{t('Milestones', 'சாதனைகள்')}</h2>
        <button type="button" onClick={() => navigate('/milestones')}>
          {t('View All', 'அனைத்தையும் பார்')}
          <Icon name="chevron" size={16} />
        </button>
      </div>
      <QueryBoundary query={badgesQ}>
        {(badges) => (
          <ul className="mp-milestones">
            {badges.map((b) => {
              const state =
                b.key === 'refer_5'
                  ? me.recruitCount >= 5
                    ? 'completed'
                    : 'locked'
                  : 'unavailable';
              return (
                <li key={b.id} data-status={state}>
                  <span>
                    <Icon
                      name={
                        state === 'completed' ? 'checkCircle' : state === 'locked' ? 'lock' : 'info'
                      }
                      size={19}
                    />
                  </span>
                  <strong>{t(b.nameEn, b.nameTa)}</strong>
                  <small>
                    {state === 'completed'
                      ? t('Completed', 'நிறைவு')
                      : state === 'locked'
                        ? t('Locked', 'பூட்டப்பட்டது')
                        : t('Not recorded', 'பதிவு இல்லை')}
                  </small>
                </li>
              );
            })}
          </ul>
        )}
      </QueryBoundary>
    </section>
  );
}
