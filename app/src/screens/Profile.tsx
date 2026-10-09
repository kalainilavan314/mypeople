import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius, type as ty } from '../theme/tokens';
import { Icon, type IconName } from '../components/Icon';
import { NetImage } from '../components/nn';
import { Toggle, QueryBoundary } from '../components/ui';
import { ProfileSkeleton } from '../components/ui/loaders-skeleton';
import { useMember } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { displayMemberName, displayMemberCode } from '../lib/memberDisplay';
import { useAuth } from '../state/auth';
import { useTheme } from '../state/theme';
import { authApi } from '../data/authApi';
import { tierDef } from '../theme/tiers';

/* ============================================================= Profile — P01
   A compact identity + activity hub (spec §7 / wireframe P01). No top cover
   image: a small avatar + identity block, then a clean navigation list and a
   deliberate sign-out. The role shown is assigned, never chosen by the member.
============================================================================= */

export function Profile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const memberQ = useMember();
  const me = useMe();
  const { logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [verifyOpen, setVerifyOpen] = useState(false);

  const status = me?.verificationStatus;
  const verified = status === 'identity_confirmed';
  const pending = status === 'review_pending';

  return (
    <QueryBoundary query={memberQ} fallback={<ProfileSkeleton />}>
      {(member) => {
        const name = displayMemberName(me) ?? member.fullName;
        const code = displayMemberCode(me) ?? member.memberCode ?? '—';
        const tier = tierDef(me?.tier ?? 'volunteer');
        const area = [me?.districtName, me?.dsName, me?.gsName].filter(Boolean).join(' / ')
          || t('profile.areaUnset', 'Area not set');

        return (
          <main className="workspace" style={{ paddingTop: 'calc(12px + var(--safe-top, 0px))' }}>
            <h1 style={{ font: `700 ${ty.page.size}px/1.15 ${font.head}`, letterSpacing: '-0.01em', color: c.ink0, margin: '0 0 16px' }}>
              {t('profile.titleMy', 'My Profile')}
            </h1>

            {/* ---------- Compact identity block ---------- */}
            <section
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: 16,
                borderRadius: radius.lg, background: c.card, border: `1px solid ${c.hairline}`, boxShadow: 'var(--shadow-card)',
              }}
            >
              <button
                type="button"
                onClick={() => navigate('/profile/edit')}
                aria-label={t('profile.editProfile', 'Edit profile')}
                style={{ flex: 'none', position: 'relative', border: 'none', background: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}
              >
                <span style={{ display: 'block', width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: c.surfaceVariant }}>
                  <NetImage src={me?.avatarUrl ?? undefined} alt={name} width={64} height={64} radius={999} fallbackIcon="user" />
                </span>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `700 ${ty.section.size}px/1.2 ${font.head}`, color: c.ink0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ font: `500 ${ty.secondary.size}px/1.3 ${font.ui}`, color: c.ink3, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {t('profile.memberShort', 'Member')} {code} · {tier.nameEn}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <StatusChip
                    good={verified}
                    warn={pending}
                    label={verified ? t('verify.confirmed', 'Identity verified') : pending ? t('verify.reviewPending', 'Review pending') : t('verify.unverified', 'Not verified')}
                  />
                  {verified && (
                    <StatusChip good label={t('profile.membershipActive', 'Membership active')} />
                  )}
                </div>
              </div>
            </section>

            {/* ---------- Primary navigation ---------- */}
            <nav aria-label={t('profile.sections', 'Profile sections')} style={{ marginTop: 16 }}>
              <div style={cardListStyle}>
                <Row icon="mapPin" title={t('profile.myArea', 'My area')} sub={area} onClick={() => navigate('/area')} first />
                <Row icon="trending" title={t('profile.myActivity', 'My activity')} sub={t('profile.myActivitySub2', 'Reports, events, surveys and learning')} onClick={() => navigate('/reports')} />
                <Row icon="pencil" title={t('profile.editProfile', 'Edit profile')} sub={t('profile.editProfileSub2', 'Update personal and contact details')} onClick={() => navigate('/profile/edit')} />
                <Row icon="shield" title={t('profile.verificationDetails', 'Verification details')} sub={t('profile.verificationSub', 'Identity and membership status')} onClick={() => setVerifyOpen(true)} />
                <Row icon="users" title={t('profile.communityHub', 'Community hub')} sub={t('profile.communityHubSub', 'Invites, skills, ideas and contributions')} onClick={() => navigate('/community')} />
              </div>
            </nav>

            {/* ---------- Account settings ---------- */}
            <div className="pf-section-head" style={{ marginTop: 20, marginBottom: 10 }}>
              <h2 style={{ font: `700 ${ty.section.size}px/1.2 ${font.head}`, color: c.ink0, margin: 0 }}>
                {t('profile.accountSettings', 'Account settings')}
              </h2>
            </div>
            <div style={cardListStyle}>
              <Row icon="globe" title={t('profile.language', 'Language')} sub={lang === 'ta' ? 'தமிழ்' : 'English'} onClick={() => navigate('/language')} first />
              <Row icon="bell" title={t('profile.notifications', 'Notifications')} sub={t('profile.notificationsSub', 'Event and review preferences')} onClick={() => navigate('/notifications')} />
              <Row icon="lock" title={t('profile.privacy', 'Privacy and consent')} sub={t('profile.privacySub', 'Control participation details')} onClick={() => navigate('/privacy')} />
              <div className="pf-menu-row" style={{ cursor: 'default', borderTop: `1px solid ${c.hairline3}` }}>
                <div className="pf-menu-icon-circle"><Icon name="moon" size={19} strokeWidth={2} /></div>
                <div className="pf-menu-text">
                  <span className="pf-menu-title">{t('profile.appearance', 'Appearance')}</span>
                  <span className="pf-menu-sub">{isDark ? t('profile.dark', 'Dark') : t('profile.light', 'Light')}</span>
                </div>
                <Toggle on={isDark} onChange={() => toggleTheme()} ariaLabel={t('profile.darkMode', 'Dark mode')} />
              </div>
              <Row icon="info" title={t('profile.helpAbout', 'Help and about')} sub="v1.0.0" onClick={() => navigate('/privacy')} />
            </div>

            {/* ---------- Sign out ---------- */}
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

            <VerificationSheet open={verifyOpen} onClose={() => setVerifyOpen(false)} status={status} t={t} />
          </main>
        );
      }}
    </QueryBoundary>
  );
}

/* ------------------------------------------------------------------ Styles */
const cardListStyle: React.CSSProperties = {
  borderRadius: radius.lg,
  background: c.card,
  border: `1px solid ${c.hairline}`,
  boxShadow: 'var(--shadow-card)',
  overflow: 'hidden',
};

/* --------------------------------------------------------------- StatusChip */
function StatusChip({ good, warn, label }: { good?: boolean; warn?: boolean; label: string }) {
  const color = good ? c.success : warn ? c.warning : c.ink3;
  const bg = good ? c.successBg : warn ? c.warningBg : c.surfaceVariant;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: radius.pill, background: bg, color, font: `600 ${ty.caption.size}px/1.3 ${font.ui}` }}>
      <Icon name={good ? 'check' : 'info'} size={12} strokeWidth={2.6} />
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------------- Row */
function Row({ icon, title, sub, onClick, first }: { icon: IconName; title: string; sub?: string; onClick: () => void; first?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px',
        background: 'none', border: 'none', borderTop: first ? 'none' : `1px solid ${c.hairline3}`,
        cursor: 'pointer', textAlign: 'left', minHeight: 56,
      }}
    >
      <span style={{ flex: 'none', width: 40, height: 40, borderRadius: radius.md, background: 'var(--soft-blue)', display: 'grid', placeItems: 'center', color: c.primary }}>
        <Icon name={icon} size={19} strokeWidth={2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: `600 ${ty.card.size}px/1.3 ${font.ui}`, color: c.ink0 }}>{title}</span>
        {sub && <span style={{ display: 'block', font: `400 ${ty.secondary.size}px/1.35 ${font.ui}`, color: c.ink3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
      <Icon name="chevron" size={17} color={c.ink4} />
    </button>
  );
}

/* ------------------------------------------------------------ VerificationSheet */
type VStatus = 'unverified' | 'nic_format' | 'review_pending' | 'identity_confirmed';

function VerificationSheet({
  open, onClose, status = 'unverified', t,
}: {
  open: boolean; onClose: () => void; status?: VStatus; t: (k: string, d: string) => string;
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="topbar-sheet-head">
        <h2>{t('verify.title', 'Verification details')}</h2>
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
