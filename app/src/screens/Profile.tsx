import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { NetImage } from '../components/nn';
import { Button, Toggle, StatusPill, EmptyState, QueryBoundary } from '../components/ui';
import { useMember, useMyCommunityReports, useEvents } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { useAuth } from '../state/auth';
import { useTheme } from '../state/theme';
import { authApi } from '../data/authApi';
import type { CommunityReportStatus } from '../data/types';

/* ================================================================== Profile
   Compact institutional profile: one navy header (the single branded surface),
   one unified stats card, a real activity feed (reports + RSVP'd events — never
   fabricated), and grouped menu lists. Presentation only — every route, action,
   data binding and permission is preserved from the previous version. */

const fmtYear = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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

  // Real recent-activity feed: community reports + RSVP'd events, newest first.
  // Nothing is invented — an empty feed shows an empty state.
  type Item = { id: string; icon: IconName; title: string; sub: string; badge: { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' }; to: string; ts: number };
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
        <main className="workspace" style={{ paddingTop: 0 }}>
          {/* ---- Hero header (regional cover image behind) ---- */}
          <header className="pf-hero">
            <div className="pf-hero-overlay" aria-hidden="true" />

            {/* top row: back + settings */}
            <div className="pf-hero-top">
              <button className="pf-icon-btn" onClick={() => navigate(-1)} aria-label={t('common.back', 'Back')}>
                <Icon name="chevronLeft" size={20} color="#fff" strokeWidth={2.2} />
              </button>
              <button className="pf-icon-btn" onClick={() => navigate('/language')} aria-label={t('profile.settings', 'Settings')}>
                <Icon name="wrench" size={18} color="#fff" strokeWidth={2} />
              </button>
            </div>

            {/* title + subtitle */}
            <div className="pf-hero-text">
              <h1 style={{ font: `700 28px/1.15 ${font.head}`, letterSpacing: '-0.01em', margin: 0 }}>{t('profile.titleMy')}</h1>
              <p style={{ font: `400 13px/1.45 ${font.ui}`, color: 'rgba(255,255,255,.82)', margin: '6px 0 0', maxWidth: 260 }}>
                {t('profile.subtitle', 'Your participation makes stronger communities')}
              </p>
            </div>

            {/* avatar + identity */}
            <div className="pf-hero-text" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
              <span style={{ position: 'relative', flex: 'none' }}>
                <span style={{ width: 92, height: 92, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.14)', border: '3px solid rgba(255,255,255,.85)' }}>
                  <NetImage src={me?.avatarUrl ?? undefined} alt={member.fullName} width={92} height={92} radius={999} fallbackIcon="user" />
                </span>
                <button
                  onClick={() => navigate('/profile/edit')}
                  aria-label={t('profile.editProfile')}
                  style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 999, border: '2px solid #fff', background: c.primary, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                >
                  <Icon name="camera" size={15} color="#fff" strokeWidth={2} />
                </button>
              </span>

              <div style={{ minWidth: 0, flex: 1, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
                <div style={{ font: `700 24px/1.2 ${font.head}`, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.fullName}</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6, color: 'rgba(255,255,255,.92)' }}>
                  <Icon name="mapPin" size={14} color="rgba(255,255,255,.92)" strokeWidth={2} style={{ flex: 'none', marginTop: 2 }} />
                  <span style={{ font: `400 14px/1.4 ${font.ui}` }}>
                    {[me?.districtName ?? member.electorateNameEn, t('profile.northernProvince', 'Northern & Eastern Province')].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {me?.gsName && (
                  <div style={{ font: `400 13px/1.4 ${font.ta}`, color: 'rgba(255,255,255,.8)', marginTop: 3 }}>
                    {t('profile.gnDivision', { name: me.gsName })}
                  </div>
                )}
              </div>
            </div>

            {/* verification pill */}
            <div style={{ position: 'relative', marginTop: 14 }}>
              <VerificationPill status={me?.verificationStatus} label={verifyLabel(t, me?.verificationStatus)} onClick={() => setVerifyOpen(true)} />
            </div>
          </header>

          {/* ---- Edit Profile card (overlaps hero) ---- */}
          <button className="pf-edit-card" onClick={() => navigate('/profile/edit')}>
            <span className="pf-edit-ic"><Icon name="wrench" size={20} color={c.secondary} strokeWidth={2} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: `700 16px/1.2 ${font.ui}`, color: c.ink0 }}>{t('profile.editProfile')}</span>
              <span style={{ display: 'block', font: `400 12.5px/1.3 ${font.ui}`, color: c.ink3, marginTop: 3 }}>{t('profile.editProfileSub', 'Update your information, photo and preferences')}</span>
            </span>
            <Icon name="chevron" size={18} color={c.ink3} />
          </button>

          <VerificationSheet open={verifyOpen} onClose={() => setVerifyOpen(false)} status={me?.verificationStatus} t={t} />

          {/* ---- Unified statistics card (4 columns) ---- */}
          <section
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: c.card, border: `1px solid ${c.hairline}`, borderRadius: 'var(--r-lg)', overflow: 'hidden', marginTop: 16 }}
          >
            <StatCol icon="report" tint="#EEF4FA" fg={c.secondary} value={reportsQ.data ? String(reportsQ.data.length) : '—'} label={t('profile.myReports')} first />
            <StatCol icon="users" tint="#F2F6F4" fg={c.success} value={me ? String(me.recruitCount) : '—'} label={t('profile.myReferrals')} />
            <StatCol icon="calendar" tint="#FBF2E0" fg={c.warning} value={activities !== undefined ? String(activities) : '—'} label={t('profile.activities')} />
            <StatCol icon="star" tint="#EEF4FA" fg={c.primary} value={fmtYear(me?.joinedAt ?? member.joinedAt)} label={t('profile.memberSinceShort', 'Member since')} />
          </section>

          {/* ---- My Activity (real feed) ---- */}
          <section className="work-section">
            <div className="work-section-head">
              <h2>{t('profile.myActivity')}</h2>
              <button type="button" onClick={() => navigate('/reports')} style={{ background: 'none', border: 0, cursor: 'pointer', font: `600 13px/1 ${font.ui}`, color: c.secondary }}>{t('profile.viewAll', 'View All')}</button>
            </div>
            <div style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
              <QueryBoundary query={reportsQ} label={t('common.loading', 'Loading…')}>
                {() =>
                  feed.length ? (
                    <>
                      {feed.map((it, i) => (
                        <button
                          key={it.id}
                          onClick={() => navigate(it.to)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'none', border: 'none', borderTop: i ? `1px solid ${c.hairline3}` : 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 'var(--r-sm)', background: c.surfaceVariant, display: 'grid', placeItems: 'center', color: c.secondary }}>
                            <Icon name={it.icon} size={19} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', font: `600 14px/1.35 ${font.ta}`, color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                            <span style={{ display: 'block', font: `400 12px/1.4 ${font.ui}`, color: c.ink3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</span>
                          </span>
                          <StatusPill label={it.badge.label} tone={it.badge.tone} />
                          <Icon name="chevron" size={16} color={c.ink3} />
                        </button>
                      ))}
                    </>
                  ) : (
                    <EmptyState icon="clipboard" title={t('profile.noActivity', 'No activity yet')} sub={t('profile.noActivitySub', 'Your reports and events will appear here.')} />
                  )
                }
              </QueryBoundary>
            </div>
          </section>

          {/* ---- Menu (all existing destinations preserved) ---- */}
          <section className="work-section">
            <h2>{t('profile.menu', 'Menu')}</h2>
            <div className="work-panel">
              <Row icon="user" label={t('profile.personalInfo', 'Personal Information')} sub={t('profile.personalInfoSub', 'View and update your details')} onClick={() => navigate('/profile/edit')} />
              <Row icon="shield" label={t('profile.membershipVerification', 'Membership & Verification')} sub={t('profile.membershipVerificationSub', 'Membership status, verification and card')} onClick={() => setVerifyOpen(true)} />
              <Row icon="trending" label={t('profile.myActivity')} sub={t('profile.myActivitySub2', 'Reports, events, learning and more')} onClick={() => navigate('/reports')} />
              <Row icon="users" label={t('profile.referrals', 'Referrals')} sub={t('profile.referralsSub', 'Invite and track your referrals')} onClick={() => navigate('/referral')} />
              <Row icon="bell" label={t('profile.notifications')} sub={t('profile.notificationsSub', 'Manage your notification preferences')} onClick={() => navigate('/notifications')} />
              <Row icon="globe" label={t('profile.language')} sub={lang === 'ta' ? 'தமிழ்' : 'English'} onClick={() => navigate('/language')} />
              <Row icon="lock" label={t('profile.privacy')} sub={t('profile.privacySub', 'Your data and consent settings')} onClick={() => navigate('/privacy')} />
              <Row icon="forum" label={t('profile.helpSupport')} sub={t('profile.helpSupportSub', 'Get help or contact us')} onClick={() => navigate('/privacy')} />
            </div>
          </section>

          <section className="work-section">
            <div className="work-panel">
              <div className="work-link" style={{ cursor: 'default' }}>
                <span className="work-icon"><Icon name={isDark ? 'moon' : 'sun'} size={20} /></span>
                <span style={{ flex: 1 }}><strong>{t('profile.darkMode')}</strong></span>
                <Toggle on={isDark} onChange={() => toggleTheme()} ariaLabel={t('profile.darkMode')} />
              </div>
              <Row icon="info" label={t('profile.about')} value="v1.0.0" />
            </div>
          </section>

          {/* ---- Logout ---- */}
          <div style={{ marginTop: 20 }}>
            <Button variant="danger" fullWidth icon="logout" onClick={() => { void authApi.logout(); logout(); navigate('/login'); }}>
              {t('profile.logout')}
            </Button>
          </div>
        </main>
      )}
    </QueryBoundary>
  );
}

/* ------------------------------------------------------------------ pieces */

type VStatus = 'unverified' | 'nic_format' | 'review_pending' | 'identity_confirmed';

// Honest status→badge mapping for the activity feed (never colour-only: label + tone).
function reportBadge(t: (k: string, d: string) => string, status: CommunityReportStatus): { label: string; tone: 'neutral' | 'success' | 'warning' | 'info' } {
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

// Honest label for each verification state — never implies more than warranted.
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

function VerificationPill({ status, label, onClick }: { status?: VStatus; label: { label: string; icon: IconName }; onClick: () => void }) {
  // Green for any completed check (nic_format / identity_confirmed), amber for a
  // pending review, neutral otherwise — on a light pill that reads over the hero.
  const good = status === 'identity_confirmed' || status === 'nic_format';
  const pending = status === 'review_pending';
  const fg = good ? '#16835D' : pending ? '#B7791F' : '#667085';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px',
        borderRadius: 999, cursor: 'pointer',
        background: 'rgba(255,255,255,.94)',
        border: '1px solid rgba(255,255,255,.6)',
        color: fg, font: `700 12.5px/1 ${font.ui}`,
        boxShadow: '0 2px 8px rgba(11,20,36,.18)',
      }}
    >
      {good ? (
        <span style={{ width: 16, height: 16, borderRadius: 999, background: fg, display: 'grid', placeItems: 'center', flex: 'none' }}>
          <Icon name="check" size={10} color="#fff" strokeWidth={3} />
        </span>
      ) : (
        <Icon name={label.icon} size={15} color={fg} strokeWidth={2} />
      )}
      {label.label}
    </button>
  );
}

// Bottom sheet explaining exactly what has and hasn't been checked.
function VerificationSheet({ open, onClose, status = 'unverified', t }: { open: boolean; onClose: () => void; status?: VStatus; t: (k: string, d: string) => string }) {
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
    <dialog className="topbar-sheet" ref={dialog} onCancel={onClose} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="topbar-sheet-head">
        <h2>{t('verify.title', 'Verification')}</h2>
        <button type="button" className="topbar-btn" onClick={onClose} aria-label={t('common.dismiss', 'Dismiss')} style={{ color: c.ink }}>
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
          <div key={r.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 4px', borderBottom: `1px solid ${c.hairline}` }}>
            <span style={{ width: 32, height: 32, borderRadius: 999, background: c.surfaceVariant, display: 'grid', placeItems: 'center', flex: 'none', color: color(r.state) }}>
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

function StatCol({ icon, tint, fg, value, label, first }: { icon: IconName; tint: string; fg: string; value: string; label: string; first?: boolean }) {
  return (
    <div style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', borderLeft: first ? 'none' : `1px solid ${c.hairline3}` }}>
      <span style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: tint, display: 'grid', placeItems: 'center', color: fg }}>
        <Icon name={icon} size={17} />
      </span>
      <div style={{ font: `700 20px/1 ${font.head}`, color: c.ink0 }}>{value}</div>
      <div style={{ font: `500 11px/1.2 ${font.ui}`, color: c.ink3 }}>{label}</div>
    </div>
  );
}

function Row({ icon, label, sub, value, onClick }: { icon: IconName; label: string; sub?: string; value?: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="work-link"
      style={{ width: '100%', background: 'none', border: 0, cursor: onClick ? 'pointer' : 'default', textAlign: 'left', font: 'inherit', alignItems: sub ? 'flex-start' : 'center' }}
    >
      <span className="work-icon" style={{ marginTop: sub ? 2 : 0 }}><Icon name={icon} size={20} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block' }}>{label}</strong>
        {sub ? <span style={{ display: 'block', font: `400 12.5px/1.35 ${font.ui}`, color: c.ink3, marginTop: 2 }}>{sub}</span> : null}
      </span>
      {value ? <span className="t-secondary" style={{ whiteSpace: 'nowrap' }}>{value}</span> : null}
      {onClick && <Icon name="chevron" size={16} color={c.ink3} style={{ flex: 'none', marginTop: sub ? 4 : 0 }} />}
    </button>
  );
}
