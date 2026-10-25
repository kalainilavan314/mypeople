import { authApi } from '@/core/api/authApi';
import { displayMemberCode, displayMemberName } from '@/core/lib/memberDisplay';
import { tierDef } from '@/core/theme/tiers';
import '@/core/theme/profile.css';
import { ProfileGroup } from '@/features/profile/components/ProfileGroup';
import { ProfileSection } from '@/features/profile/components/ProfileSection';
import { LogoutConfirmDialog } from '@/features/profile/components/LogoutConfirmDialog';
import { Row } from '@/features/profile/components/Row';
import { VerificationSheet } from '@/features/profile/components/VerificationSheet';
import { Icon } from '@/shared/components/Icon';
import { QueryBoundary } from '@/shared/components/ui';
import { useAuth } from '@/shared/hooks/useAuth';
import { useMeQuery } from '@/shared/hooks/useMe';
import { useTheme } from '@/shared/hooks/useTheme';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const meQ = useMeQuery();
  const { logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      queryClient.clear();
      logout();
      setLogoutConfirmOpen(false);
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  const languageName = lang.startsWith('ta') ? 'தமிழ்' : lang.startsWith('si') ? 'සිංහල' : 'English';

  return (
    <QueryBoundary query={meQ}>
      {(member) => {
        if (!member) return (
          <main className="civic-page profile-page">
            <h1>{t('profile.unavailable', 'Membership information unavailable')}</h1>
          </main>
        );
        const name = displayMemberName(member) ?? member.fullName;
        const code = displayMemberCode(member) ?? member.memberCode ?? '—';
        const status = member.verificationStatus;
        const verified = status === 'identity_confirmed';
        const pending = status === 'review_pending';
        const area = [member.districtName, member.dsName, member.gsName].filter(Boolean).join(' / ')
          || t('profile.areaUnset', 'Area not set');

        return (
          <main className="civic-page profile-page">
            <h1 className="sr-only">{t('profile.titleMy', 'My Profile')}</h1>
            <ProfileSection
              navigate={navigate}
              t={t}
              me={member}
              name={name}
              code={code}
              lang={lang}
              tier={tierDef(member.tier ?? 'volunteer')}
              verified={verified}
              pending={pending}
              onOpenVerification={() => setVerifyOpen(true)}
            />
            <nav className="profile-account-groups" aria-label={t('profile.sections', 'Profile sections')}>
              <ProfileGroup title={lang === 'ta' ? 'எனது உறுப்பினர் விவரங்கள்' : 'My membership'}>
                <Row icon="mapPin" title={t('profile.myArea', 'My area')} sub={area}
                  value={member.districtName ?? undefined} onClick={() => navigate('/area')} />
                <Row icon="card" title={t('nav.card', 'Card')} onClick={() => navigate('/card')} />
                <Row icon="shield" title={t('profile.verificationDetails', 'Verification details')}
                  sub={t('profile.verificationSub', 'Identity and membership status')}
                  onClick={() => setVerifyOpen(true)} />
              </ProfileGroup>
              <ProfileGroup title={t('profile.myActivity', 'My activity')}>
                <Row icon="report" title={t('profile.myReports', 'My reports')}
                  sub={t('profile.reportActivity', 'Reports and receipts')} onClick={() => navigate('/reports')} />
                <Row icon="users" title={t('profile.communityHub', 'Community hub')}
                  sub={t('profile.communityHubSub', 'Invites, skills, ideas and contributions')}
                  onClick={() => navigate('/community')} />
              </ProfileGroup>
              <ProfileGroup title={t('profile.accountSettings', 'Account settings')}>
                <Row icon="globe" title={t('profile.language', 'Language')} value={languageName}
                  onClick={() => navigate('/language')} />
                <button type="button" role="switch" aria-checked={isDark}
                  aria-label={t('profile.darkModeSwitch', 'Dark mode')}
                  className="profile-account-row profile-account-theme" onClick={toggleTheme}>
                  <Icon name={isDark ? 'moon' : 'sun'} size={21} strokeWidth={1.7} />
                  <span className="profile-account-label">{t('profile.appearance', 'Appearance')}</span>
                  <span className="profile-account-value">
                    {isDark ? t('profile.darkMode', 'Dark mode') : t('profile.lightMode', 'Light')}
                  </span>
                  <span className="profile-account-switch" aria-hidden="true"><span /></span>
                </button>
                <Row icon="bell" title={t('profile.notifications', 'Notifications')}
                  onClick={() => navigate('/notifications')} />
                <Row icon="lock" title={t('profile.privacy', 'Privacy and consent')}
                  onClick={() => navigate('/privacy')} />
                <Row icon="info" title={t('profile.helpAbout', 'Help and about')}
                  value="v1.0.0" onClick={() => navigate('/privacy')} />
              </ProfileGroup>
            </nav>
            <button
              type="button"
              className="profile-account-logout"
              onClick={() => setLogoutConfirmOpen(true)}
              aria-haspopup="dialog"
            >
              <Icon name="logout" size={20} strokeWidth={1.8} />
              <span>{t('profile.logout', 'Sign out')}</span>
            </button>
            <VerificationSheet open={verifyOpen} onClose={() => setVerifyOpen(false)} status={status} t={t} />
            <LogoutConfirmDialog
              open={logoutConfirmOpen}
              onClose={() => {
                if (!isLoggingOut) setLogoutConfirmOpen(false);
              }}
              onConfirm={handleLogout}
              loading={isLoggingOut}
              t={t}
            />
          </main>
        );
      }}
    </QueryBoundary>
  );
}
