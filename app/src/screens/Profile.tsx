import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font } from '../theme/tokens';
import { Icon, type IconName } from '../components/Icon';
import { NetImage } from '../components/nn';
import { Button, Toggle, QueryBoundary } from '../components/ui';
import { useMember, useMyCommunityReports, useEvents } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { useAuth } from '../state/auth';
import { useTheme } from '../state/theme';

/* ================================================================== Profile
   Institutional workspace profile: a single navy header (the one branded
   surface here), one neutral stat style, and grouped panels for activity and
   account settings. No rainbow tiles, no stock avatar, no shimmer — hierarchy
   and spacing carry the screen. */

const fmtYear = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric' }) : '—';

export function Profile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const memberQ = useMember();
  const me = useMe();
  const reportsQ = useMyCommunityReports();
  const eventsQ = useEvents();
  const { logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();

  const activities = eventsQ.data ? eventsQ.data.filter((e) => e.myStatus === 'going').length : undefined;

  return (
    <QueryBoundary query={memberQ}>
      {(member) => (
        <main className="workspace" style={{ paddingTop: 0 }}>
          {/* ---- Navy header (the one branded surface) ---- */}
          <header
            style={{
              background: 'var(--grad-primary)',
              color: '#fff',
              margin: '0 -20px 24px',
              padding: 'calc(24px + var(--safe-top, 0px)) 20px 24px',
              borderRadius: '0 0 var(--r-2xl) var(--r-2xl)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span className="t-section" style={{ color: '#fff' }}>{t('profile.titleMy')}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ width: 72, height: 72, borderRadius: 999, overflow: 'hidden', flex: 'none', background: 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center' }}>
                <NetImage src={me?.avatarUrl ?? undefined} alt={`${member.fullName}`} width={72} height={72} radius={999} fallbackIcon="user" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `700 20px/1.25 ${font.head}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.fullName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: 'rgba(255,255,255,.82)' }}>
                  <Icon name="mapPin" size={14} color="rgba(255,255,255,.82)" strokeWidth={2} />
                  <span style={{ font: `500 13px/1.3 ${font.ui}` }}>
                    {[me?.districtName ?? member.electorateNameEn, t('profile.northernProvince', 'Northern Province')].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {me?.gsName && (
                  <div className="ta" style={{ font: `400 13px/1.4 ${font.ta}`, color: 'rgba(255,255,255,.66)', marginTop: 4 }}>
                    {t('profile.gnDivision', { name: me.gsName })}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/profile/edit')}
              style={{
                marginTop: 20, width: '100%', height: 52, cursor: 'pointer',
                borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,255,255,.4)',
                background: 'rgba(255,255,255,.1)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                font: `600 16px/1 ${font.ui}`,
              }}
            >
              <Icon name="wrench" size={17} color="#fff" strokeWidth={2} />
              {t('profile.editProfile')}
            </button>
          </header>

          {/* ---- Stats (one neutral style) ---- */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Stat icon="report" value={reportsQ.data ? String(reportsQ.data.length) : '—'} label={t('profile.myReports')} />
            <Stat icon="users" value={me ? String(me.recruitCount) : '—'} label={t('profile.myReferrals')} />
            <Stat icon="calendar" value={activities !== undefined ? String(activities) : '—'} label={t('profile.activities')} />
            <Stat icon="idCard" value={fmtYear(me?.joinedAt ?? member.joinedAt)} label={t('profile.memberSinceShort', 'Member since')} />
          </section>

          {/* ---- My activity ---- */}
          <section className="work-section">
            <h2>{t('profile.myActivity')}</h2>
            <div className="work-panel">
              <Row icon="clipboard" label={t('profile.mySurveys')} onClick={() => navigate('/survey')} />
              <Row icon="handHeart" label={t('profile.myActivities')} onClick={() => navigate('/events')} />
              <Row icon="report" label={t('profile.myReports')} onClick={() => navigate('/reports')} />
              <Row icon="bulb" label={t('profile.myIdeas')} onClick={() => navigate('/ideas')} />
              <Row icon="book" label={t('profile.myCourses')} onClick={() => navigate('/courses')} />
              <Row icon="users" label={t('profile.myReferrals')} onClick={() => navigate('/referral')} />
            </div>
          </section>

          {/* ---- Account ---- */}
          <section className="work-section">
            <h2>{t('profile.account')}</h2>
            <div className="work-panel">
              <Row icon="globe" label={t('profile.language')} value={i18n.language === 'ta' ? 'தமிழ்' : 'English'} onClick={() => navigate('/language')} />
              <Row icon="bell" label={t('profile.notifications')} onClick={() => navigate('/notifications')} />
              <Row icon="lock" label={t('profile.privacy')} onClick={() => navigate('/privacy')} />
              <Row icon="mapPin" label={t('profile.location')} value={me?.districtName ?? member.electorateNameEn ?? ''} onClick={() => navigate('/profile/edit')} />
              <div className="work-link" style={{ cursor: 'default' }}>
                <span className="work-icon"><Icon name={isDark ? 'moon' : 'sun'} size={20} /></span>
                <span style={{ flex: 1 }}><strong>{t('profile.darkMode')}</strong></span>
                <Toggle on={isDark} onChange={() => toggleTheme()} ariaLabel={t('profile.darkMode')} />
              </div>
              <Row icon="forum" label={t('profile.helpSupport')} onClick={() => navigate('/privacy')} />
              <Row icon="info" label={t('profile.about')} value="v1.0.0" />
            </div>
          </section>

          {/* ---- Logout ---- */}
          <div style={{ marginTop: 24 }}>
            <Button variant="danger" fullWidth icon="logout" onClick={() => { logout(); navigate('/login'); }}>
              {t('profile.logout')}
            </Button>
          </div>
        </main>
      )}
    </QueryBoundary>
  );
}

/* ------------------------------------------------------------------ pieces */

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <div style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: c.surfaceVariant, display: 'grid', placeItems: 'center', color: c.maroon }}>
        <Icon name={icon} size={20} />
      </span>
      <div style={{ font: `700 24px/1 ${font.head}`, color: c.ink0 }}>{value}</div>
      <div className="t-secondary">{label}</div>
    </div>
  );
}

function Row({ icon, label, value, onClick }: { icon: IconName; label: string; value?: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="work-link"
      style={{ width: '100%', background: 'none', border: 0, cursor: onClick ? 'pointer' : 'default', textAlign: 'left', font: 'inherit' }}
    >
      <span className="work-icon"><Icon name={icon} size={20} /></span>
      <span style={{ flex: 1, minWidth: 0 }}><strong>{label}</strong></span>
      {value ? <span className="t-secondary" style={{ whiteSpace: 'nowrap' }}>{value}</span> : null}
      {onClick && <Icon name="chevron" size={16} color={c.ink3} />}
    </button>
  );
}
