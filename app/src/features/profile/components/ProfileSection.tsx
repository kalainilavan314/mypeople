import type { ServerMember } from '@/core/api/auth/models';
import { tierDef } from '@/core/theme/tiers';
import { StatusChip } from '@/features/profile/components/StatusChip';
import { NetImage } from '@/shared/components/nn';
import { MEMBERSHIP_STATUS_TEXT, membershipStateOf } from '@/shared/membership/membershipStatus';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';

type Props = {
  navigate: ReturnType<typeof useNavigate>;
  t: TFunction<'translation', undefined>;
  me: ServerMember;
  name: string;
  code: string;
  lang: string;
  tier: ReturnType<typeof tierDef>;
  verified: boolean;
  pending: boolean;
};

export function ProfileSection({ navigate, t, me, name, code, lang, tier, verified, pending }: Props) {
  return (
    <header className="profile-account-identity">
      <button type="button" className="profile-account-avatar"
        onClick={() => navigate('/profile/edit')} aria-label={t('profile.editProfile', 'Edit profile')}>
        <NetImage src={me.avatarUrl ?? undefined} alt={name} width="100%" height="100%"
          radius="50%" fallbackIcon="user" fallbackGrad="var(--primary)" />
      </button>
      <h2>{name}</h2>
      <p className="profile-account-code">{code}</p>
      {me.phone && <p className="profile-account-contact">{me.phone}</p>}
      <span className="profile-account-tier">{lang === 'ta' ? tier.nameTa : tier.nameEn}</span>
      <div className="profile-account-status">
        <StatusChip good={verified} warn={pending}
          label={verified ? t('verify.confirmed', 'Identity verified') : pending
            ? t('verify.reviewPending', 'Review pending') : t('verify.unverified', 'Not verified')} />
        <StatusChip good={membershipStateOf(me) === 'active'} warn={membershipStateOf(me) === 'pending'}
          label={MEMBERSHIP_STATUS_TEXT[membershipStateOf(me)].long[lang === 'ta' ? 'ta' : 'en']} />
      </div>
      <button type="button" className="profile-account-edit" onClick={() => navigate('/profile/edit')}>
        {t('profile.editProfile', 'Edit profile')}
      </button>
    </header>
  );
}
