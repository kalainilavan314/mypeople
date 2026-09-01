import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius } from '../theme/tokens';
import { Icon, type IconName } from '../components/Icon';
import { NetImage } from '../components/nn';
import { Toggle, QueryBoundary } from '../components/ui';
import { useMember, useMyCommunityReports } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { useAuth } from '../state/auth';
import { useTheme } from '../state/theme';

/* ================================================================== Profile
   NorthUnity animated profile: deep-navy gradient header with floating
   particles, shimmer-ring avatar and pulsing Edit button, then staggered
   light sections — gradient stat cards, badge chips, activity grid, account
   list, gradient logout. Header is deliberately COMPACT (tight paddings, no
   dead space under the button) per user feedback on the reference. */

const HEADER_TOP = '#0D1B3E';
const HEADER_MID = '#1A2F6B';
const HEADER_BOT = '#2D1B69';
const CYAN = '#00D4FF';
const VIOLET = '#9B59F5';
const GOLD = '#FFD166';
const MINT = '#06D6A0';

const AVATAR = 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg';

/* Deterministic particle field (no Math.random at render — stable across renders). */
const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const h = (n: number) => ((i * 37 + 13) * n % 97) / 97;
  return {
    left: h(7) * 100,
    top: h(11) * 100,
    size: 2 + h(5) * 4,
    opacity: 0.15 + h(3) * 0.35,
    dur: 5 + h(13) * 6,
    delay: -h(17) * 8,
  };
});

const gradText = (from: string, to: string): React.CSSProperties => ({
  background: `linear-gradient(90deg, ${from}, ${to})`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

const fmtSince = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';

export function Profile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const memberQ = useMember();
  const me = useMe();
  const reportsQ = useMyCommunityReports();
  const { logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const accountRef = useRef<HTMLDivElement>(null);

  const reportCount = reportsQ.data?.length ?? 0;

  return (
    <div style={{ background: c.page, minHeight: '100%' }}>
      <style>{`
        @keyframes pfIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
        @keyframes pfSpin { to { transform: rotate(360deg); } }
        @keyframes pfPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
        @keyframes pfFloat {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-150px) translateX(10px); }
          100% { transform: translateY(-300px) translateX(0); opacity: 0; }
        }
        .pf-sec { opacity: 0; animation: pfIn .6s cubic-bezier(.22,.61,.36,1) forwards; }
        .pf-ring { animation: pfSpin 3.2s linear infinite; }
        .pf-pulse { animation: pfPulse 1.4s ease-in-out infinite; }
        .pf-part { animation: pfFloat linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pf-sec { animation-duration: 1ms; }
          .pf-ring, .pf-pulse, .pf-part { animation: none; }
        }
      `}</style>

      <QueryBoundary query={memberQ}>
        {(member) => (
          <>
            {/* ======================= header (compact) ======================= */}
            <div
              className="pf-sec"
              style={{
                position: 'relative', overflow: 'hidden', color: '#fff',
                background: `linear-gradient(135deg, ${HEADER_TOP} 0%, ${HEADER_MID} 50%, ${HEADER_BOT} 100%)`,
                borderRadius: '0 0 32px 32px', padding: '14px 20px 20px',
              }}
            >
              {/* floating particles */}
              {PARTICLES.map((p, i) => (
                <span
                  key={i}
                  className="pf-part"
                  aria-hidden="true"
                  style={{
                    position: 'absolute', left: `${p.left}%`, top: `${p.top}%`,
                    width: p.size, height: p.size, borderRadius: 999,
                    background: `rgba(255,255,255,${p.opacity})`,
                    animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
                  }}
                />
              ))}
              {/* decorative circles */}
              <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 999, background: 'rgba(155,89,245,.10)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: 999, background: 'rgba(0,212,255,.08)' }} />

              {/* top bar */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 4, height: 20, borderRadius: 2, background: `linear-gradient(180deg, ${CYAN}, ${VIOLET})` }} />
                  <span style={{ font: `800 20px/1 ${font.head}`, letterSpacing: '-0.3px' }}>{t('profile.titleMy')}</span>
                </div>
                <button
                  onClick={() => accountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  aria-label={t('profile.account')}
                  className="press"
                  style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(0,212,255,.24)', background: 'rgba(0,212,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Icon name="wrench" size={19} color={CYAN} strokeWidth={1.9} />
                </button>
              </div>

              {/* avatar + info */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
                {/* shimmer-ring avatar */}
                <div style={{ position: 'relative', width: 84, height: 84, flex: 'none' }}>
                  <span
                    aria-hidden="true"
                    className="pf-ring"
                    style={{ position: 'absolute', inset: 0, borderRadius: 999, background: `conic-gradient(${CYAN}, ${VIOLET}, ${GOLD}, ${MINT}, ${CYAN})` }}
                  />
                  <span style={{ position: 'absolute', inset: 3, borderRadius: 999, overflow: 'hidden', background: HEADER_MID }}>
                    <NetImage src={me?.avatarUrl ?? AVATAR} alt={`Profile photo of ${member.fullName}`} width={78} height={78} radius={999} fallbackIcon="user" />
                  </span>
                  <span aria-hidden="true" style={{ position: 'absolute', bottom: 2, right: 2, width: 16, height: 16, borderRadius: 999, background: MINT, border: `2px solid ${HEADER_MID}`, boxShadow: `0 0 6px rgba(6,214,160,.5)` }} />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ font: `800 20px/1.2 ${font.head}`, letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.fullName}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,212,255,.12)', border: '1px solid rgba(0,212,255,.32)' }}>
                    <Icon name="mapPin" size={11} color={CYAN} strokeWidth={2.2} />
                    <span style={{ font: `600 10.5px/1 ${font.ui}`, color: CYAN }}>
                      {(me?.districtName ?? member.electorateNameEn ?? 'Northern Province')} • Northern Province
                    </span>
                  </span>
                  {me?.gsName && (
                    <div style={{ font: `400 11.5px/1.3 ${font.ta}`, color: 'rgba(255,255,255,.5)', marginTop: 5 }}>
                      {t('profile.gnDivision', { name: me.gsName })}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                    <Icon name="calendar" size={10} color={GOLD} strokeWidth={2.2} />
                    <span style={{ font: `500 10.5px/1 ${font.ui}`, color: GOLD }}>
                      {t('profile.memberSince', { date: fmtSince(me?.joinedAt ?? member.joinedAt) })}
                    </span>
                  </div>
                </div>
              </div>

              {/* pulsing edit button — tight below, no dead space */}
              <button
                onClick={() => navigate('/profile/edit')}
                className="pf-pulse press"
                style={{
                  position: 'relative', width: '100%', height: 44, marginTop: 18, border: 'none', cursor: 'pointer',
                  borderRadius: 14, background: `linear-gradient(90deg, ${CYAN}, ${VIOLET})`,
                  boxShadow: '0 6px 16px rgba(155,89,245,.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  font: `700 14px/1 ${font.head}`, color: '#fff', letterSpacing: '.3px',
                }}
              >
                <Icon name="wrench" size={15} color="#fff" strokeWidth={2.2} />
                {t('profile.editProfile')}
              </button>
            </div>

            {/* ======================= stats row ======================= */}
            <div className="pf-sec" style={{ display: 'flex', gap: 10, padding: '20px 16px 0', animationDelay: '.15s' }}>
              <StatCard icon="clipboard" value="4" label={t('profile.surveys')} from="#4776E6" to="#8E54E9" />
              <StatCard icon="clock" value="12h" label={t('profile.volHours')} from="#FF6B6B" to="#FFD166" />
              <StatCard icon="handHeart" value={String(member.checkInCount ?? 3)} label={t('profile.activities')} from="#06D6A0" to="#00D4FF" />
              <StatCard icon="bookmark" value="2" label={t('profile.projects')} from="#FF9A9E" to="#FECFEF" />
            </div>

            {/* ======================= badge chips ======================= */}
            <div className="pf-sec nn-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '18px 16px 0', animationDelay: '.28s' }}>
              <BadgeChip icon="users" label={t('profile.badgeMember')} from="#4776E6" to="#8E54E9" />
              <BadgeChip icon="handHeart" label={t('profile.badgeVolunteer')} from="#FF6B6B" to="#FFD166" />
              <BadgeChip icon="mic" label={t('profile.badgeVoice')} from="#06D6A0" to="#00D4FF" />
            </div>

            {/* ======================= my activity ======================= */}
            <div className="pf-sec" style={{ padding: '24px 16px 0', animationDelay: '.4s' }}>
              <SectionLabel label={t('profile.myActivity')} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
                <ActivityCard icon="clipboard" label={t('profile.mySurveys')} count={t('profile.nCompleted', { n: 4 })} from="#4776E6" to="#8E54E9" onClick={() => navigate('/survey')} />
                <ActivityCard icon="handHeart" label={t('profile.myActivities')} count={t('profile.nJoined', { n: member.checkInCount ?? 3 })} from="#FF6B6B" to="#FFD166" onClick={() => navigate('/events')} />
                <ActivityCard icon="report" label={t('profile.myReports')} count={t('profile.nSubmitted', { n: reportCount })} from="#06D6A0" to="#00D4FF" onClick={() => navigate('/reports')} />
                <ActivityCard icon="bulb" label={t('profile.myIdeas')} count={t('profile.nShared', { n: 2 })} from="#FF9A9E" to="#FECFEF" onClick={() => navigate('/ideas')} />
                <ActivityCard icon="book" label={t('profile.myCourses')} count={t('profile.nEnrolled', { n: 0 })} from="#F7971E" to="#FFD200" onClick={() => navigate('/courses')} />
                <ActivityCard icon="users" label={t('profile.myReferrals')} count={t('profile.nReferred', { n: member.referredCount ?? 0 })} from="#11998E" to="#38EF7D" onClick={() => navigate('/referral')} />
              </div>
            </div>

            {/* ======================= account ======================= */}
            <div ref={accountRef} className="pf-sec" style={{ padding: '24px 16px 0', animationDelay: '.52s', scrollMarginTop: 12 }}>
              <SectionLabel label={t('profile.account')} />
              <div style={{ background: c.card, borderRadius: radius.xl, boxShadow: '0 6px 20px rgba(71,118,230,.10)', marginTop: 12, overflow: 'hidden' }}>
                <AccountRow icon="globe" label={t('profile.language')} value={i18n.language === 'ta' ? 'தமிழ்' : 'English'} from="#4776E6" to="#8E54E9" onClick={() => navigate('/language')} />
                <AccountRow icon="bell" label={t('profile.notifications')} value={t('profile.on')} from="#FF6B6B" to="#FFD166" onClick={() => navigate('/notifications')} />
                <AccountRow icon="lock" label={t('profile.privacy')} from="#06D6A0" to="#00D4FF" onClick={() => navigate('/privacy')} />
                <AccountRow icon="mapPin" label={t('profile.location')} value={me?.districtName ?? member.electorateNameEn ?? ''} from="#FF9A9E" to="#FECFEF" onClick={() => navigate('/card')} />
                {/* dark mode row keeps the real toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderTop: `1px solid ${c.hairline}` }}>
                  <GradIconSquare icon={isDark ? 'moon' : 'sun'} from="#8E54E9" to="#4776E6" />
                  <span style={{ flex: 1, font: `600 14px/1.3 ${font.ta}`, color: c.ink }}>{t('profile.darkMode')}</span>
                  <Toggle on={isDark} onChange={() => toggleTheme()} ariaLabel={t('profile.darkMode')} />
                </div>
                <AccountRow icon="forum" label={t('profile.helpSupport')} from="#11998E" to="#38EF7D" onClick={() => navigate('/privacy')} />
                <AccountRow icon="info" label={t('profile.about')} value="v1.0.0" from="#F7971E" to="#FFD200" last />
              </div>
            </div>

            {/* ======================= logout ======================= */}
            <div className="pf-sec" style={{ padding: '20px 16px calc(28px + var(--safe-bottom))', animationDelay: '.64s' }}>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="press"
                style={{
                  width: '100%', height: 52, border: 'none', cursor: 'pointer', borderRadius: 16,
                  background: 'linear-gradient(90deg, #FF6B6B, #EE0979)', color: '#fff',
                  boxShadow: '0 8px 18px rgba(238,9,121,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  font: `700 15px/1 ${font.head}`, letterSpacing: '.3px',
                }}
              >
                <Icon name="logout" size={18} color="#fff" strokeWidth={2} />
                {t('profile.logout')}
              </button>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 3, height: 14, borderRadius: 2, background: `linear-gradient(180deg, ${CYAN}, ${VIOLET})` }} />
      <span style={{ font: `800 12px/1 ${font.head}`, letterSpacing: '.1em', textTransform: 'uppercase', color: c.ink2 }}>{label}</span>
    </div>
  );
}

function GradIconSquare({ icon, from, to, size = 36 }: { icon: IconName; from: string; to: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 10, background: `linear-gradient(135deg, ${from}, ${to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={icon} size={Math.round(size * 0.48)} color="#fff" strokeWidth={2} />
    </span>
  );
}

function StatCard({ icon, value, label, from, to }: { icon: IconName; value: string; label: string; from: string; to: string }) {
  return (
    <div style={{ flex: 1, background: c.card, borderRadius: 16, padding: '14px 6px', textAlign: 'center', boxShadow: `0 4px 12px ${from}28` }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <GradIconSquare icon={icon} from={from} to={to} size={38} />
      </div>
      <div style={{ font: `800 18px/1 ${font.head}`, color: from, marginTop: 8 }}>{value}</div>
      <div style={{ font: `500 10px/1.3 ${font.ta}`, color: c.ink3, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function BadgeChip({ icon, label, from, to }: { icon: IconName; label: string; from: string; to: string }) {
  return (
    <span
      style={{
        flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, height: 44, padding: '0 14px',
        borderRadius: 26, border: `1px solid ${from}55`,
        background: `linear-gradient(90deg, ${from}1E, ${to}1E)`,
      }}
    >
      <Icon name={icon} size={16} color={from} strokeWidth={2} />
      <span style={{ font: `700 12px/1 ${font.ta}`, ...gradText(from, to) }}>{label}</span>
    </span>
  );
}

function ActivityCard({ icon, label, count, from, to, onClick }: { icon: IconName; label: string; count: string; from: string; to: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14,
        aspectRatio: '0.88', padding: 12, textAlign: 'left', cursor: 'pointer',
        background: c.card, border: 'none', borderRadius: 16, boxShadow: `0 4px 10px ${from}24`,
      }}
    >
      <GradIconSquare icon={icon} from={from} to={to} size={34} />
      <span>
        <span style={{ display: 'block', font: `700 11px/1.3 ${font.ta}`, color: c.ink }}>{label}</span>
        <span style={{ display: 'block', font: `400 10px/1.3 ${font.ui}`, color: c.ink3, marginTop: 2 }}>{count}</span>
      </span>
    </button>
  );
}

function AccountRow({ icon, label, value, from, to, onClick, last = false }: { icon: IconName; label: string; value?: string; from: string; to: string; onClick?: () => void; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
        background: 'transparent', border: 'none', borderTop: 'none',
        borderBottom: last ? 'none' : `1px solid ${c.hairline}`,
        cursor: onClick ? 'pointer' : 'default', textAlign: 'left',
      }}
    >
      <GradIconSquare icon={icon} from={from} to={to} />
      <span style={{ flex: 1, font: `600 14px/1.3 ${font.ta}`, color: c.ink }}>{label}</span>
      {value ? (
        <span style={{ font: `600 11px/1 ${font.ui}`, color: from, background: `${from}14`, padding: '4px 8px', borderRadius: 6 }}>{value}</span>
      ) : null}
      {onClick && <Icon name="chevron" size={17} color={`${from}99`} strokeWidth={2.2} />}
    </button>
  );
}
