import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { NetImage } from '../components/nn';
import { Toggle, StatusPill, QueryBoundary } from '../components/ui';
import { useMember, useMyCommunityReports, useEvents } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { useAuth } from '../state/auth';
import { useTheme } from '../state/theme';
import { authApi } from '../data/authApi';
import type { CommunityReportStatus } from '../data/types';

const fmtYear = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function Profile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const memberQ = useMember();
  const me = useMe();
  const reportsQ = useMyCommunityReports();
  const eventsQ = useEvents();
  const { logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [verifyOpen, setVerifyOpen] = useState(false);

  const goingEvents = eventsQ.data ? eventsQ.data.filter((e) => e.myStatus === 'going') : [];
  const activities = eventsQ.data ? goingEvents.length : undefined;

  // Real recent-activity feed: community reports + RSVP'd events
  type Item = {
    id: string;
    icon: IconName;
    title: string;
    sub: string;
    badge: { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' };
    to: string;
    ts: number;
  };
  const feed: Item[] = [
    ...(reportsQ.data ?? []).map((r) => ({
      id: 'r' + r.id,
      icon: 'report' as IconName,
      title: r.title,
      sub: [r.districtName, fmtDay(r.createdAt)].filter(Boolean).join(' · '),
      badge: reportBadge(t, r.status),
      to: '/reports',
      ts: Date.parse(r.createdAt),
    })),
    ...goingEvents.map((e) => ({
      id: 'e' + e.id,
      icon: 'calendar' as IconName,
      title: pick(lang, e.titleTa, e.titleEn) || e.titleEn || e.titleTa,
      sub: [e.venue, fmtDay(e.startsAt)].filter(Boolean).join(' · '),
      badge: { label: t('common.going', 'Going'), tone: 'success' as const },
      to: '/events/' + e.id,
      ts: Date.parse(e.startsAt),
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 4);

  return (
    <QueryBoundary query={memberQ}>
      {(member) => (
        <main className="workspace" style={{ paddingTop: 0, paddingBottom: 80 }}>
          {/* ---- Hero header (regional cover image behind) ---- */}
          <header className="pf-hero-container">
            <div className="pf-hero-overlay" aria-hidden="true" />

            {/* top row: back + settings */}
            <div className="pf-hero-top">
              <button
                type="button"
                className="pf-icon-btn"
                onClick={() => navigate(-1)}
                aria-label={t('common.back', 'Back')}
              >
                <Icon name="chevronLeft" size={20} color="#ffffff" strokeWidth={2.4} />
              </button>
              <button
                type="button"
                className="pf-icon-btn"
                onClick={() => navigate('/language')}
                aria-label={t('profile.settings', 'Settings')}
              >
                <Icon name="settings" size={19} color="#ffffff" strokeWidth={2} />
              </button>
            </div>

            {/* title + subtitle */}
            <div className="pf-hero-header-text">
              <h1 className="pf-hero-title">{t('profile.titleMy', 'My Profile')}</h1>
              <p className="pf-hero-sub">
                {t('profile.subtitle', 'Your participation makes stronger communities')}
              </p>
            </div>

            {/* avatar + identity */}
            <div className="pf-identity-row">
              <div className="pf-avatar-box">
                <div className="pf-avatar-circle">
                  <NetImage
                    src={me?.avatarUrl ?? undefined}
                    alt={member.fullName}
                    width={80}
                    height={80}
                    radius={999}
                    fallbackIcon="user"
                  />
                </div>
                <button
                  type="button"
                  className="pf-avatar-cam-btn"
                  onClick={() => navigate('/profile/edit')}
                  aria-label={t('profile.editProfile', 'Edit Profile')}
                >
                  <Icon name="camera" size={14} color="#ffffff" strokeWidth={2} />
                </button>
              </div>

              <div className="pf-identity-meta">
                <div className="pf-user-name">{member.fullName || 'dabi'}</div>
                <div className="pf-user-loc">
                  <Icon name="mapPin" size={14} color="rgba(255,255,255,0.9)" strokeWidth={2} style={{ flex: 'none' }} />
                  <span>
                    {[me?.districtName ?? member.electorateNameEn ?? 'Nallur', t('profile.northernProvince', 'Northern & Eastern Province')]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <div>
                  <VerificationPill
                    status={me?.verificationStatus}
                    label={verifyLabel(t, me?.verificationStatus)}
                    onClick={() => setVerifyOpen(true)}
                  />
                </div>
              </div>
            </div>
          </header>

          {/* ---- Edit Profile card (overlapping hero) ---- */}
          <button
            type="button"
            className="pf-edit-card-redesign"
            onClick={() => navigate('/profile/edit')}
          >
            <div className="pf-edit-icon-box">
              <Icon name="pencil" size={20} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="pf-edit-title">{t('profile.editProfile', 'Edit Profile')}</span>
              <span className="pf-edit-sub">
                {t('profile.editProfileSub', 'Update your information, photo and preferences')}
              </span>
            </div>
            <Icon name="chevron" size={18} color="#94A3B8" />
          </button>

          <VerificationSheet
            open={verifyOpen}
            onClose={() => setVerifyOpen(false)}
            status={me?.verificationStatus}
            t={t}
          />

          {/* ---- Unified 4-column statistics card ---- */}
          <section className="pf-stats-card">
            <StatItem
              icon="report"
              bg="#EBF3FC"
              color="#1468D9"
              value={reportsQ.data ? String(reportsQ.data.length) : '—'}
              label={t('profile.myReports', 'My Reports')}
            />
            <StatItem
              icon="users"
              bg="#EAF7F0"
              color="#16835D"
              value={me?.recruitCount !== undefined ? String(me.recruitCount) : '—'}
              label={t('profile.myReferrals', 'My Referrals')}
            />
            <StatItem
              icon="calendar"
              bg="#FFF5E8"
              color="#D97706"
              value={activities !== undefined ? String(activities) : '0'}
              label={t('profile.activities', 'Activities')}
            />
            <StatItem
              icon="star"
              bg="#F3E8FF"
              color="#7C3AED"
              value={fmtYear(me?.joinedAt ?? member.joinedAt) || 'Nov 2024'}
              label={t('profile.memberSinceShort', 'Member since')}
            />
          </section>

          {/* ---- My Activity Section ---- */}
          <section>
            <div className="pf-section-head">
              <h2 className="pf-section-title">{t('profile.myActivity', 'My Activity')}</h2>
              <button
                type="button"
                className="pf-section-viewall"
                onClick={() => navigate('/reports')}
              >
                {t('profile.viewAll', 'View All')}
                <Icon name="chevron" size={14} />
              </button>
            </div>

            <QueryBoundary query={reportsQ} label={t('common.loading', 'Loading…')}>
              {() =>
                feed.length > 0 ? (
                  <div className="pf-menu-card" style={{ marginTop: 0 }}>
                    {feed.map((it, i) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => navigate(it.to)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          background: 'none',
                          border: 'none',
                          borderTop: i ? `1px solid ${c.hairline3}` : 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            flex: 'none',
                            width: 38,
                            height: 38,
                            borderRadius: '10px',
                            background: '#EBF3FC',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#1468D9',
                          }}
                        >
                          <Icon name={it.icon} size={18} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: 'block',
                              font: `600 13.5px/1.35 ${font.ui}`,
                              color: '#102D55',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {it.title}
                          </span>
                          <span
                            style={{
                              display: 'block',
                              font: `400 11.5px/1.4 ${font.ui}`,
                              color: '#64748B',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {it.sub}
                          </span>
                        </span>
                        <StatusPill label={it.badge.label} tone={it.badge.tone} />
                        <Icon name="chevron" size={15} color="#94A3B8" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pf-activity-empty-card">
                    <div className="pf-activity-empty-graphic">
                      {/* Document outline icon */}
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="3" width="14" height="18" rx="2.5" />
                        <path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4" />
                      </svg>
                      <div className="pf-activity-empty-badge">
                        <Icon name="clock" size={13} color="#ffffff" strokeWidth={2.4} />
                      </div>
                    </div>
                    <div className="pf-activity-empty-content">
                      <h3 className="pf-activity-empty-title">{t('profile.noActivity', 'No recent activity yet')}</h3>
                      <p className="pf-activity-empty-sub">
                        {t('profile.noActivitySub', 'Your reports, events, learning and community activity will appear here.')}
                      </p>
                      <button
                        type="button"
                        className="pf-explore-events-btn"
                        onClick={() => navigate('/events')}
                      >
                        {t('profile.exploreEvents', 'Explore Events')}
                        <Icon name="arrowRight" size={14} />
                      </button>
                    </div>
                  </div>
                )
              }
            </QueryBoundary>
          </section>

          {/* ---- Menu Section ---- */}
          <section>
            <div className="pf-section-head">
              <h2 className="pf-section-title">{t('profile.menu', 'Menu')}</h2>
            </div>
            <div className="pf-menu-card" style={{ marginTop: 0 }}>
              <MenuRow
                icon="user"
                title={t('profile.personalInfo', 'Personal Information')}
                sub={t('profile.personalInfoSub', 'View and update your details')}
                onClick={() => navigate('/profile/edit')}
              />
              <MenuRow
                icon="shield"
                title={t('profile.membershipVerification', 'Membership & Verification')}
                sub={t('profile.membershipVerificationSub', 'Membership status, verification and card')}
                onClick={() => setVerifyOpen(true)}
              />
              <MenuRow
                icon="trending"
                title={t('profile.myActivity', 'My Activity')}
                sub={t('profile.myActivitySub2', 'Reports, events, learning and more')}
                onClick={() => navigate('/reports')}
              />
              <MenuRow
                icon="users"
                title={t('profile.referrals', 'Referrals')}
                sub={t('profile.referralsSub', 'Invite and track your referrals')}
                onClick={() => navigate('/referral')}
              />
              <MenuRow
                icon="bell"
                title={t('profile.notifications', 'Notifications')}
                sub={t('profile.notificationsSub', 'Manage your notification preferences')}
                onClick={() => navigate('/notifications')}
              />
              <MenuRow
                icon="globe"
                title={t('profile.language', 'Language')}
                sub={lang === 'ta' ? 'தமிழ்' : 'English'}
                onClick={() => navigate('/language')}
              />
              <MenuRow
                icon="lock"
                title={t('profile.privacy', 'Privacy & Consent')}
                sub={t('profile.privacySub', 'Your data and consent settings')}
                onClick={() => navigate('/privacy')}
              />
              <MenuRow
                icon="forum"
                title={t('profile.helpSupport', 'Help & Support')}
                sub={t('profile.helpSupportSub', 'Get help or contact us')}
                onClick={() => navigate('/privacy')}
              />
            </div>
          </section>

          {/* ---- Dark Mode & About Card ---- */}
          <section className="pf-menu-card" style={{ marginTop: 14 }}>
            <div className="pf-menu-row" style={{ cursor: 'default' }}>
              <div className="pf-menu-icon-circle">
                <Icon name="moon" size={18} strokeWidth={2} />
              </div>
              <div className="pf-menu-text">
                <span className="pf-menu-title">{t('profile.darkMode', 'Dark mode')}</span>
                <span className="pf-menu-sub">{t('profile.darkModeSub', 'Switch between light and dark themes')}</span>
              </div>
              <Toggle on={isDark} onChange={() => toggleTheme()} ariaLabel={t('profile.darkMode')} />
            </div>

            <div
              className="pf-menu-row"
              onClick={() => navigate('/privacy')}
              role="button"
              tabIndex={0}
            >
              <div className="pf-menu-icon-circle">
                <Icon name="info" size={18} strokeWidth={2} />
              </div>
              <div className="pf-menu-text">
                <span className="pf-menu-title">{t('profile.about', 'About My People')}</span>
                <span className="pf-menu-sub">{t('profile.aboutSub', 'App information and version details')}</span>
              </div>
              <span style={{ font: `600 12.5px/1 ${font.ui}`, color: '#94A3B8', marginRight: 4 }}>
                v1.0.0
              </span>
              <Icon name="chevron" size={16} color="#94A3B8" />
            </div>
          </section>

          {/* ---- Standalone Log Out Button ---- */}
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
            <span>{t('profile.logout', 'Log out')}</span>
          </button>
        </main>
      )}
    </QueryBoundary>
  );
}

/* ------------------------------------------------------------------ Sub-components */

type VStatus = 'unverified' | 'nic_format' | 'review_pending' | 'identity_confirmed';

function reportBadge(
  t: (k: string, d: string) => string,
  status: CommunityReportStatus
): { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' } {
  switch (status) {
    case 'under_review':
      return { label: t('report.underReview', 'Under Review'), tone: 'warning' };
    case 'in_progress':
      return { label: t('report.inProgress', 'In Progress'), tone: 'info' };
    case 'resolved':
      return { label: t('report.resolved', 'Resolved'), tone: 'success' };
    default:
      return { label: t('report.submitted', 'Submitted'), tone: 'neutral' };
  }
}

function verifyLabel(t: (k: string, d: string) => string, status?: VStatus): { label: string; icon: IconName } {
  switch (status) {
    case 'identity_confirmed':
      return { label: t('verify.confirmed', 'Identity confirmed'), icon: 'check' };
    case 'review_pending':
      return { label: t('verify.reviewPending', 'Identity review pending'), icon: 'info' };
    case 'nic_format':
      return { label: t('verify.nicFormat', 'NIC format checked'), icon: 'idCard' };
    default:
      return { label: t('verify.unverified', 'Not verified'), icon: 'info' };
  }
}

function VerificationPill({
  status,
  label,
  onClick,
}: {
  status?: VStatus;
  label: { label: string; icon: IconName };
  onClick: () => void;
}) {
  const good = status === 'identity_confirmed' || status === 'nic_format';
  const pending = status === 'review_pending';
  const cls = good ? 'pf-verify-pill-btn verified' : pending ? 'pf-verify-pill-btn pending' : 'pf-verify-pill-btn';
  return (
    <button type="button" onClick={onClick} aria-label={label.label} className={cls}>
      {good ? (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#16835D',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }}
        >
          <Icon name="check" size={9} color="#ffffff" strokeWidth={3} />
        </span>
      ) : (
        <Icon name={label.icon} size={13} strokeWidth={2} />
      )}
      {label.label}
    </button>
  );
}

function StatItem({
  icon,
  bg,
  color,
  value,
  label,
}: {
  icon: IconName;
  bg: string;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <div className="pf-stat-item">
      <div className="pf-stat-icon-wrap" style={{ background: bg, color }}>
        <Icon name={icon} size={18} />
      </div>
      <div className="pf-stat-val">{value}</div>
      <div className="pf-stat-label">{label}</div>
    </div>
  );
}

function MenuRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="pf-menu-row" onClick={onClick}>
      <div className="pf-menu-icon-circle">
        <Icon name={icon} size={19} strokeWidth={2} />
      </div>
      <div className="pf-menu-text">
        <span className="pf-menu-title">{title}</span>
        {sub && <span className="pf-menu-sub">{sub}</span>}
      </div>
      <Icon name="chevron" size={17} color="#94A3B8" />
    </button>
  );
}

// Bottom sheet explaining verification steps
function VerificationSheet({
  open,
  onClose,
  status = 'unverified',
  t,
}: {
  open: boolean;
  onClose: () => void;
  status?: VStatus;
  t: (k: string, d: string) => string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);

  type State = 'done' | 'active' | 'todo';
  const rank: Record<VStatus, number> = { unverified: 0, nic_format: 1, review_pending: 2, identity_confirmed: 3 };
  const cur = rank[status];
  const rows: { label: string; hint: string; state: State }[] = [
    { label: t('verify.stepNic', 'NIC format'), hint: t('verify.stepNicHint', 'The ID number is well-formed.'), state: cur >= 1 ? 'done' : 'active' },
    { label: t('verify.stepInfo', 'Member information'), hint: t('verify.stepInfoHint', 'Your details were submitted.'), state: cur >= 1 ? 'done' : 'todo' },
    { label: t('verify.stepReview', 'Coordinator review'), hint: t('verify.stepReviewHint', 'A coordinator confirms your identity against official records.'), state: cur >= 3 ? 'done' : cur === 2 ? 'active' : 'todo' },
  ];
  const icon = (s: State): IconName => (s === 'done' ? 'check' : s === 'active' ? 'clock' : 'info');
  const color = (s: State) => (s === 'done' ? c.success : s === 'active' ? c.warning : c.ink3);

  return (
    <dialog
      className="topbar-sheet"
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="topbar-sheet-head">
        <h2>{t('verify.title', 'Verification')}</h2>
        <button
          type="button"
          className="topbar-btn"
          onClick={onClose}
          aria-label={t('common.dismiss', 'Dismiss')}
          style={{ color: c.ink }}
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <p className="t-secondary" style={{ margin: '0 0 8px' }}>
        {status === 'identity_confirmed'
          ? t('verify.introConfirmed', 'Your identity has been confirmed.')
          : t('verify.intro', "Here's what has been checked so far and what's still pending.")}
      </p>
      <div>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '12px 4px',
              borderBottom: `1px solid ${c.hairline}`,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: c.surfaceVariant,
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                color: color(r.state),
              }}
            >
              <Icon name={icon(r.state)} size={16} strokeWidth={2.2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: `600 14px/1.3 ${font.ui}`, color: c.ink }}>{r.label}</div>
              <div className="t-caption" style={{ marginTop: 2 }}>{r.hint}</div>
            </div>
            <span style={{ font: `600 12px/1 ${font.ui}`, color: color(r.state), flex: 'none', marginTop: 4 }}>
              {r.state === 'done' ? t('verify.done', 'Done') : r.state === 'active' ? t('verify.pending', 'Pending') : t('verify.todo', 'Not yet')}
            </span>
          </div>
        ))}
      </div>
    </dialog>
  );
}
