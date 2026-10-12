import { authApi } from '@/core/api/authApi';
import { displayMemberCode, displayMemberName } from '@/core/lib/memberDisplay';
import { tierDef } from '@/core/theme/tiers';
import { c, font } from '@/core/theme/tokens';
import { ProfileSection } from '@/features/profile/components/ProfileSection';
import { Row } from '@/features/profile/components/Row';
import { VerificationSheet } from '@/features/profile/components/VerificationSheet';
import { cardListStyle } from '@/features/profile/Profile.model';
import { Icon } from '@/shared/components/Icon';
import { QueryBoundary, Toggle } from '@/shared/components/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { useMeQuery } from '@/shared/hooks/useMe';
import { useTheme } from '@/shared/hooks/useTheme';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
export function Profile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const meQ = useMeQuery();
  const me = meQ.data;
  const { logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [verifyOpen, setVerifyOpen] = useState(false);

  const status = me?.verificationStatus;
  const verified = status === 'identity_confirmed';
  const pending = status === 'review_pending';

  return (
    <QueryBoundary query={meQ}>
      {(member) => {
        if (!member)
          return (
            <main className="civic-page">
              <h1>{t('profile.unavailable', 'Membership information unavailable')}</h1>
            </main>
          );
        const name = displayMemberName(me) ?? member.fullName;
        const code = displayMemberCode(me) ?? member.memberCode ?? '—';
        const tier = tierDef(me?.tier ?? 'volunteer');
        const area =
          [me?.districtName, me?.dsName, me?.gsName].filter(Boolean).join(' / ') ||
          t('profile.areaUnset', 'Area not set');

        return (
          <main className="civic-page">
            <h1
              style={{
                font: `700 1.375rem/1.4 ${font.head}`,
                letterSpacing: '-0.01em',
                color: c.ink0,
                margin: '0 0 16px',
              }}
            >
              {t('profile.titleMy', 'My Profile')}
            </h1>

            <ProfileSection
              navigate={navigate}
              t={t}
              me={me}
              name={name}
              code={code}
              lang={lang}
              tier={tier}
              verified={verified}
              pending={pending}
            />

            <nav aria-label={t('profile.sections', 'Profile sections')} style={{ marginTop: 16 }}>
              <div style={cardListStyle}>
                <Row
                  icon="mapPin"
                  title={t('profile.myArea', 'My area')}
                  sub={area}
                  onClick={() => navigate('/area')}
                  first
                />
                <Row
                  icon="trending"
                  title={t('profile.myActivity', 'My activity')}
                  sub={t('profile.reportActivity', 'Reports and receipts')}
                  onClick={() => navigate('/reports')}
                />
                <Row
                  icon="pencil"
                  title={t('profile.editProfile', 'Edit profile')}
                  sub={t('profile.editProfileSub2', 'Update personal and contact details')}
                  onClick={() => navigate('/profile/edit')}
                />
                <Row
                  icon="shield"
                  title={t('profile.verificationDetails', 'Verification details')}
                  sub={t('profile.verificationSub', 'Identity and membership status')}
                  onClick={() => setVerifyOpen(true)}
                />
                <Row
                  icon="users"
                  title={t('profile.communityHub', 'Community hub')}
                  sub={t('profile.communityHubSub', 'Invites, skills, ideas and contributions')}
                  onClick={() => navigate('/community')}
                />
              </div>
            </nav>

            <div className="pf-section-head" style={{ marginTop: 20, marginBottom: 10 }}>
              <h2 style={{ font: `700 1rem/1.5 ${font.head}`, color: c.ink0, margin: 0 }}>
                {t('profile.accountSettings', 'Account settings')}
              </h2>
            </div>
            <div style={cardListStyle}>
              <Row
                icon="globe"
                title={t('profile.language', 'Language')}
                sub={lang === 'ta' ? 'தமிழ்' : 'English'}
                onClick={() => navigate('/language')}
                first
              />
              <Row
                icon="bell"
                title={t('profile.notifications', 'Notifications')}
                sub={t('profile.notificationsSub', 'Event and review preferences')}
                onClick={() => navigate('/notifications')}
              />
              <Row
                icon="lock"
                title={t('profile.privacy', 'Privacy and consent')}
                sub={t('profile.privacySub', 'Control participation details')}
                onClick={() => navigate('/privacy')}
              />
              <div className="civic-profile-row" style={{ cursor: 'default' }}>
                <Icon name="moon" size={20} strokeWidth={2} />
                <div className="pf-menu-text">
                  <span className="pf-menu-title">{t('profile.appearance', 'Appearance')}</span>
                  <span className="pf-menu-sub">
                    {isDark ? t('profile.darkMode', 'Dark mode') : t('profile.lightMode', 'Light')}
                  </span>
                </div>
                <Toggle
                  on={isDark}
                  onChange={() => toggleTheme()}
                  ariaLabel={t('profile.darkModeSwitch', 'Dark mode')}
                />
              </div>
              <Row
                icon="info"
                title={t('profile.helpAbout', 'Help and about')}
                sub="v1.0.0"
                onClick={() => navigate('/privacy')}
              />
            </div>

            <button
              type="button"
              className="pf-logout-btn"
              onClick={() => {
                void authApi.logout();
                logout();
                navigate('/login');
              }}
            >
              <Icon name="logout" size={18} color="#ffffff" strokeWidth={2.4} />
              <span>{t('profile.logout', 'Sign out')}</span>
            </button>

            <VerificationSheet
              open={verifyOpen}
              onClose={() => setVerifyOpen(false)}
              status={status}
              t={t}
            />
          </main>
        );
      }}
    </QueryBoundary>
  );
}
