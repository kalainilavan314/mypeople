import type { ServerMember } from '@/core/api/auth/models';
import '@/core/theme/membership-card.css';
import { tierDef } from '@/core/theme/tiers';
import { Detail } from '@/features/card/components/Detail';
import { Icon } from '@/shared/components/Icon';
import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { useNavigate } from 'react-router-dom';

type Props = {
  t: ReturnType<typeof useWorkspaceText>;
  navigate: ReturnType<typeof useNavigate>;
  me: ServerMember;
  memberSince: string;
  tier: ReturnType<typeof tierDef>;
  verification: string;
  status: string;
  copyReferral: (code: string) => Promise<void>;
};
export function CardMpSection({
  t,
  navigate,
  me,
  memberSince,
  tier,
  verification,
  status,
  copyReferral,
}: Props) {
  return (
    <section className="mp-section">
      <div className="mp-section-heading">
        <h2>{t('Membership Details', 'உறுப்பினர் விவரங்கள்')}</h2>
        <button type="button" onClick={() => navigate('/profile/edit')}>
          <Icon name="pencil" size={16} />
          {t('Edit', 'திருத்து')}
        </button>
      </div>
      <dl className="mp-details">
        <Detail icon="user" label={t('Full name', 'முழுப் பெயர்')} value={me.fullName} />
        <Detail icon="idCard" label={t('Member ID', 'உறுப்பினர் எண்')} value={me.memberCode} mono />
        <Detail icon="globe" label={t('District', 'மாவட்டம்')} value={me.districtName || '—'} />
        <Detail
          icon="home"
          label={t('DS Division', 'பிரதேச செயலகப் பிரிவு')}
          value={me.dsName || '—'}
        />
        <Detail
          icon="mapPin"
          label={t('GS Division', 'கிராம சேவகர் பிரிவு')}
          value={me.gsName || '—'}
        />
        <Detail icon="calendar" label={t('Member since', 'உறுப்பினரான நாள்')} value={memberSince} />
        <Detail
          icon="star"
          label={t('Membership type', 'உறுப்பினர் வகை')}
          value={t(tier.nameEn, tier.nameTa)}
        />
        <Detail
          icon="shield"
          label={t('Identity verification', 'அடையாளச் சரிபார்ப்பு')}
          value={verification}
        />
        <Detail
          icon="checkCircle"
          label={t('Membership status', 'உறுப்பினர் நிலை')}
          value={status}
        />
        <div className="mp-detail">
          <dt>
            <Icon name="users" size={16} />
            {t('Referral ID', 'அழைப்புக் குறியீடு')}
          </dt>
          <dd>
            <span className="mp-mono">{me.referralCode || '—'}</span>
            <button
              className="mp-copy"
              type="button"
              aria-label={t('Copy referral ID', 'அழைப்புக் குறியீட்டை நகலெடு')}
              onClick={() => void copyReferral(me.referralCode)}
            >
              <Icon name="share" size={17} />
            </button>
          </dd>
        </div>
      </dl>
    </section>
  );
}
