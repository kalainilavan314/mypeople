import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { NetImage } from '../components/nn';
import { Button, Toggle, StatusPill, EmptyState, QueryBoundary } from '../components/ui';
import { PalmyraMark } from '../components/PalmyraMark';
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
          {/* ---- Compact navy header (the one branded surface) ---- */}
          <header
            style={{
              position: 'relative',
              overflow: 'hidden',
              background: c.primary,
              color: '#fff',
              margin: '0 -16px 20px',
              padding: 'calc(20px + var(--safe-top, 0px)) 16px 16px',
              borderRadius: '0 0 var(--r-2xl) var(--r-2xl)',
            }}
          >
            <PalmyraMark size={200} stroke="#FFFFFF" opacity={0.06} style={{ position: 'absolute', right: -44, top: -30 }} />

            {/* title + subtitle */}
            <div style={{ position: 'relative' }}>
              <h1 style={{ font: `700 28px/1.15 ${font.head}`, letterSpacing: '-0.01em', margin: 0 }}>{t('profile.titleMy')}</h1>
              <p style={{ font: `400 13px/1.45 ${font.ui}`, color: 'rgba(255,255,255,.72)', margin: '6px 0 0', maxWidth: 300 }}>
                {t('profile.subtitle', 'Your participation makes stronger communities')}
              </p>
            </div>

            {/* avatar + identity */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
              <span style={{ position: 'relative', flex: 'none' }}>
                <span style={{ width: 92, height: 92, borderRadius: 999, overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.12)', border: '2px solid rgba(255,255,255,.25)' }}>
                  <NetImage src={me?.avatarUrl ?? undefined} alt={member.fullName} width={92} height={92} radius={999} fallbackIcon="user" />
                </span>
                <button
                  onClick={() => navigate('/profile/edit')}
                  aria-label={t('profile.editProfile')}
                  style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 999, border: '2px solid #14263D', background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                >
                  <Icon name="camera" size={15} color={c.primary} strokeWidth={2} />
                </button>
              </span>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: `700 23px/1.2 ${font.head}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.fullName}</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6, color: 'rgba(255,255,255,.85)' }}>
                  <Icon name="mapPin" size={14} color="rgba(255,255,255,.85)" strokeWidth={2} style={{ flex: 'none', marginTop: 2 }} />
                  <span style={{ font: `400 14px/1.4 ${font.ui}` }}>
                    {[me?.districtName ?? member.electorateNameEn, t('profile.northernProvince', 'Northern & Eastern Province')].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {me?.gsName && (
                  <div className="ta" style={{ font: `400 13px/1.4 ${font.ta}`, color: 'rgba(255,255,255,.66)', marginTop: 3 }}>
                    {t('profile.gnDivision', { name: me.gsName })}
                  </div>
                )}
              </div>
            </div>

            {/* verification pill */}
            <div style={{ position: 'relative', marginTop: 14 }}>
              <VerificationPill status={me?.verificationStatus} label={verifyLabel(t, me?.verificationStatus)} onClick={() => setVerifyOpen(true)} />
            </div>

            {/* compact Edit Profile row */}
            <button
              onClick={() => navigate('/profile/edit')}
              style={{
                position: 'relative', marginTop: 16, width: '100%', height: 58, cursor: 'pointer',
                borderRadius: 'var(--r-lg)', border: '1px solid rgba(255,255,255,.16)', background: '#fff',
                display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', textAlign: 'left',
              }}
            >
              <Icon name="wrench" size={18} color={c.primary} strokeWidth={2} />
              <span style={{ flex: 1, font: `600 15px/1 ${font.ui}`, color: c.ink }}>{t('profile.editProfile')}</span>
              <Icon name="chevron" size={17} color={c.ink3} />
            </button>
          </header>

          <VerificationSheet open={verifyOpen} onClose={() => setVerifyOpen(false)} status={me?.verificationStatus} t={t} />

          {/* ---- Unified statistics card (4 columns) ---- */}
          <section
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: c.card, border: `1px solid ${c.hairline}`, borderRadius: 'var(--r-lg)', overflow: 'hidden' }}
          >
            <StatCol icon="report" tint="#EEF4FA" fg={c.secondary} value={reportsQ.data ? String(reportsQ.data.length) : '—'} label={t('profile.myReports')} first />
            <StatCol icon="users" tint="#F2F6F4" fg={c.success} value={me ? String(me.recruitCount) : '—'} label={t('profile.myReferrals')} />
            <StatCol icon="calendar" tint="#FBF2E0" fg={c.warning} value={activities !== undefined ? String(activities) : '—'} label={t('profile.activities')} />
            <StatCol icon="star" tint="#EEF4FA" fg={c.primary} value={fmtYear(me?.joinedAt ?? member.joinedAt)} label={t('profile.memberSinceShort', 'Member since')} />
          </section>

          {/* ---- My Activity (real feed) ---- */}
          <section className="work-section">
            <h2>{t('profile.myActivity')}</h2>
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
              <Row icon="user" label={t('profile.personalInfo', 'Personal Information')} onClick={() => navigate('/profile/edit')} />
              <Row icon="shield" label={t('profile.membershipVerification', 'Membership & Verification')} onClick={() => setVerifyOpen(true)} />
              <Row icon="report" label={t('profile.myReports')} onClick={() => navigate('/reports')} />
              <Row icon="calendar" label={t('profile.myActivities')} onClick={() => navigate('/events')} />
              <Row icon="clipboard" label={t('profile.mySurveys')} onClick={() => navigate('/survey')} />
              <Row icon="bulb" label={t('profile.myIdeas')} onClick={() => navigate('/ideas')} />
              <Row icon="book" label={t('profile.myCourses')} onClick={() => navigate('/courses')} />
              <Row icon="users" label={t('profile.myReferrals')} onClick={() => navigate('/referral')} />
            </div>
          </section>

          <section className="work-section">
            <h2>{t('profile.account')}</h2>
            <div className="work-panel">
              <Row icon="globe" label={t('profile.language')} value={lang === 'ta' ? 'தமிழ்' : 'English'} onClick={() => navigate('/language')} />
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
  const confirmed = status === 'identity_confirmed';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 10px 0 12px',
        borderRadius: 999, cursor: 'pointer',
        background: confirmed ? 'rgba(150,199,176,.22)' : 'rgba(255,255,255,.12)',
        border: `1px solid ${confirmed ? 'rgba(150,199,176,.6)' : 'rgba(255,255,255,.28)'}`,
        color: '#fff', font: `600 12.5px/1 ${font.ui}`,
      }}
    >
      <Icon name={label.icon} size={13} color="#fff" strokeWidth={2} />
      {label.label}
      <Icon name="check" size={13} color={confirmed ? '#96C7B0' : 'rgba(255,255,255,.75)'} strokeWidth={2.4} />
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
