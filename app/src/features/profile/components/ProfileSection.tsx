import type { ServerMember } from '@/core/api/auth/models';
import { tierDef } from '@/core/theme/tiers';
import { c, font, radius, type as ty } from '@/core/theme/tokens';
import { StatusChip } from '@/features/profile/components/StatusChip';
import { NetImage } from '@/shared/components/nn';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';

type Props = {
  navigate: ReturnType<typeof useNavigate>;
  t: TFunction<'translation', undefined>;
  me: ServerMember | null | undefined;
  name: string;
  code: string;
  lang: string;
  tier: ReturnType<typeof tierDef>;
  verified: boolean;
  pending: boolean;
};
export function ProfileSection({
  navigate,
  t,
  me,
  name,
  code,
  lang,
  tier,
  verified,
  pending,
}: Props) {
  return (
    <section
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: radius.lg,
        background: c.card,
        border: `1px solid ${c.hairline}`,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <button
        type="button"
        onClick={() => navigate('/profile/edit')}
        aria-label={t('profile.editProfile', 'Edit profile')}
        style={{
          flex: 'none',
          position: 'relative',
          border: 'none',
          background: 'none',
          padding: 0,
          cursor: 'pointer',
          borderRadius: '50%',
        }}
      >
        <span
          style={{
            display: 'block',
            width: 48,
            height: 48,
            borderRadius: '50%',
            overflow: 'hidden',
            background: c.surfaceVariant,
          }}
        >
          <NetImage
            src={me?.avatarUrl ?? undefined}
            alt={name}
            width={48}
            height={48}
            radius={999}
            fallbackIcon="user"
          />
        </span>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: `700 1rem/1.5 ${font.head}`,
            color: c.ink0,
            overflowWrap: 'anywhere',
          }}
        >
          {name}
        </div>
        <div
          style={{
            font: `500 ${ty.secondary.size / 16}rem/1.3 ${font.ui}`,
            color: c.ink3,
            marginTop: 4,
            overflowWrap: 'anywhere',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {t('profile.memberShort', 'Member')} {code} · {lang === 'ta' ? tier.nameTa : tier.nameEn}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            flexWrap: 'wrap',
          }}
        >
          <StatusChip
            good={verified}
            warn={pending}
            label={
              verified
                ? t('verify.confirmed', 'Identity verified')
                : pending
                  ? t('verify.reviewPending', 'Review pending')
                  : t('verify.unverified', 'Not verified')
            }
          />
          <StatusChip
            good={me?.membershipStatus === 'active'}
            warn={me?.membershipStatus === 'pending'}
            label={
              me?.membershipStatus === 'active'
                ? t('profile.membershipActive', 'Membership active')
                : me?.membershipStatus === 'pending'
                  ? t('profile.membershipPending', 'Membership pending')
                  : me?.membershipStatus === 'suspended'
                    ? t('profile.membershipSuspended', 'Membership suspended')
                    : me?.membershipStatus === 'inactive'
                      ? t('profile.membershipInactive', 'Membership inactive')
                      : t('profile.membershipUnknown', 'Membership status unavailable')
            }
          />
        </div>
      </div>
    </section>
  );
}
