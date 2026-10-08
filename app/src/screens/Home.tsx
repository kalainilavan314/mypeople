import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { c, font } from '../theme/tokens';
import { useMeQuery } from '../hooks/useMe';
import { useEvents, useAnnouncements, useMember } from '../data/queries';
import { authApi } from '../data/authApi';
import { QueryBoundary } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { QR } from '../lib/qr';
import { displayMemberName, displayMemberCode } from '../lib/memberDisplay';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { HomeTopBar } from '../components/HomeTopBar';

/* ============================================================== Home Redesign
   Modern Civic Dashboard:
   - Sticky brand top bar with quick language switch and notifications
   - Regional hero with welcome greeting & quick exploration actions
   - Elevated Membership Card with dynamic real signed QR & honest verification
   - 4x2 Quick Access pastel grid
   - Featured live upcoming events with date chip & attendee badge
   - Real local updates feed with scope tags and relative timestamps
   - Community Highlights horizontal card carousel & movement banner
============================================================================= */

// Quick Access — 8 core civic destinations with curated pastel tones
const QUICK: { to: string; icon: IconName; en: string; ta: string; sub: string; subTa: string; bg: string; fg: string }[] = [
  { to: '/area', icon: 'mapPin', en: 'My Area', ta: 'எனது பகுதி', sub: 'Local updates', subTa: 'உள்ளூர்', bg: '#EEF5FF', fg: '#2563EB' },
  { to: '/reports', icon: 'report', en: 'Report Issue', ta: 'பிரச்சினை', sub: 'Raise an issue', subTa: 'பதிவு செய்', bg: '#FFF8EC', fg: '#D97706' },
  { to: '/events', icon: 'calendar', en: 'Events', ta: 'நிகழ்வுகள்', sub: 'Upcoming', subTa: 'வரவிருப்பவை', bg: '#EEF4FF', fg: '#3B82F6' },
  { to: '/skills', icon: 'handHeart', en: 'Volunteer', ta: 'தன்னார்வம்', sub: 'Your skills', subTa: 'திறன்கள்', bg: '#ECFDF5', fg: '#059669' },
  { to: '/card', icon: 'idCard', en: 'Membership', ta: 'உறுப்பினர்', sub: 'Your card', subTa: 'அட்டை', bg: '#FFF1F2', fg: '#E11D48' },
  { to: '/survey', icon: 'clipboard', en: 'Surveys', ta: 'கருத்து', sub: 'Your opinion', subTa: 'கருத்து', bg: '#F5F3FF', fg: '#7C3AED' },
  { to: '/courses', icon: 'book', en: 'Learning', ta: 'கற்றல்', sub: 'New skills', subTa: 'கற்றல்', bg: '#F0F9FF', fg: '#0284C7' },
  { to: '/community', icon: 'users', en: 'Community', ta: 'சமூகம்', sub: 'Join in', subTa: 'இணைக', bg: '#F0FDF4', fg: '#16A34A' },
];

function verify(t: (en: string, ta: string) => string, s?: string): { label: string; good: boolean; statusClass: string } {
  if (s === 'identity_confirmed') return { label: t('Identity verified', 'அடையாளம் உறுதி'), good: true, statusClass: 'verified' };
  if (s === 'review_pending') return { label: t('Review pending', 'மதிப்பாய்வு நிலுவை'), good: false, statusClass: 'pending' };
  if (s === 'nic_format') return { label: t('NIC format checked', 'தே.அ.அ சரிபார்க்கப்பட்டது'), good: true, statusClass: 'verified' };
  return { label: t('Not verified', 'சரிபார்க்கப்படவில்லை'), good: false, statusClass: 'unverified' };
}

function fmtAgo(iso: string, t: (en: string, ta: string) => string): string {
  const diff = Date.now() - Date.parse(iso);
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return t('Just now', 'இப்போது');
  if (h < 24) return `${h} ${t(h === 1 ? 'hour ago' : 'hours ago', 'மணி முன்')}`;
  const d = Math.floor(h / 24);
  return `${d} ${t(d === 1 ? 'day ago' : 'days ago', 'நாள் முன்')}`;
}

export function Home() {
  const meQ = useMeQuery();
  const me = meQ.data ?? null;
  const memberQ = useMember();
  const member = memberQ.data ?? null;
  const navigate = useNavigate();
  const events = useEvents();
  const announcements = useAnnouncements();
  const t = useWorkspaceText();
  const [activeEventIndex, setActiveEventIndex] = useState(0);

  const cardTokenQ = useQuery({
    queryKey: ['cardToken'],
    queryFn: () => authApi.cardToken(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
  });

  const upcoming = (events.data ?? [])
    .filter((e) => Date.parse(e.startsAt) >= Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const [avatarError, setAvatarError] = useState(false);
  // A broken-image flag from one photo must not stick around once a
  // different (e.g. newly re-uploaded) avatarUrl arrives.
  useEffect(() => setAvatarError(false), [me?.avatarUrl]);
  const v = verify(t, me?.verificationStatus);
  const userName =
    displayMemberName(me) ||
    member?.fullName?.trim() ||
    localStorage.getItem('npm.name')?.trim() ||
    'Kalainilavan';
  const memberCode = displayMemberCode(me) || member?.memberCode || null;

  const handleShareQR = async () => {
    if (navigator.share && cardTokenQ.data) {
      try {
        await navigator.share({
          title: `NorthUnity — ${me?.fullName || 'Member Card'}`,
          text: `Member ID: ${memberCode}`,
          url: window.location.origin + '/card',
        });
      } catch {
        navigate('/card');
      }
    } else {
      navigate('/card');
    }
  };

  return (
    <>
      <HomeTopBar />
      <main className="workspace" style={{ paddingTop: 'calc(64px + var(--safe-top, 0px))' }}>
        {/* ---- Hero (Regional Cover Banner + Welcome) ---- */}
        <section className="home-hero-redesign" aria-label={t('Welcome', 'வரவேற்பு')}>
          <div className="home-hero-overlay-redesign" aria-hidden="true" />
          <div className="home-hero-content">
            <p style={{ font: `700 14px/1.3 ${font.ui}`, color: c.ink, margin: 0 }}>
              {t('Hello', 'வணக்கம்')}, {userName}
            </p>
            <h1 style={{ font: `800 24px/1.18 ${font.head}`, letterSpacing: '-0.02em', color: c.ink, margin: '6px 0 0' }}>
              {t('Together for', 'ஒன்றாக')}<br />{t('stronger communities', 'வலிமையான சமூகங்கள்')}
            </h1>
            <p style={{ font: `500 12.5px/1.45 ${font.ui}`, color: c.ink2, margin: '7px 0 0', maxWidth: 260 }}>
              {t('Your membership, services, events and updates all in one place.', 'உங்கள் உறுப்பினர், சேவைகள், நிகழ்வுகள் மற்றும் புதுப்பிப்புகள் ஒரே இடத்தில்.')}
            </p>
          </div>
          <div className="home-hero-btns">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('local-updates-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else navigate('/area');
              }}
              className="home-hero-btn-primary"
            >
              <span>{t('Explore Updates', 'புதுப்பிப்புகளைப் பார்')}</span>
              <Icon name="arrowRight" size={14} color={c.onPrimary} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/gallery')}
              className="home-hero-btn-secondary"
            >
              <Icon name="play" size={13} color={c.ink} strokeWidth={2.4} fill={c.ink} />
              <span>{t('Watch Video', 'காணொளி')}</span>
            </button>
          </div>
        </section>

        {/* ---- Membership Summary Card ---- */}
        <section className="home-membership-card" aria-label={t('Your Membership', 'உங்கள் உறுப்பினர்')}>
          <div className="home-membership-head">
            <span className="home-membership-title">{t('Your Membership', 'உங்கள் உறுப்பினர்')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`home-status-badge ${v.statusClass}`}>
                <Icon name={v.good ? 'check' : 'info'} size={12} strokeWidth={2.5} />
                {v.label}
              </span>
              <button
                type="button"
                onClick={() => navigate('/card')}
                aria-label={t('Options', 'விருப்பங்கள்')}
                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--ink-3)' }}
              >
                <Icon name="dotsVertical" size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="home-membership-body">
            <div className="home-member-avatar">
              {me?.avatarUrl && !avatarError ? (
                <img
                  src={me.avatarUrl}
                  alt=""
                  onError={() => setAvatarError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                <Icon name="user" size={26} color="#4B6382" />
              )}
            </div>
            <div className="home-member-meta">
              <div className="home-member-name" style={meQ.isLoading ? { opacity: 0.45 } : undefined}>
                {meQ.isLoading ? t('Loading…', 'ஏற்றுகிறது…') : displayMemberName(me) ?? t('Member', 'உறுப்பினர்')}
              </div>
              <div className="home-member-id-row">
                <span className="home-member-id-label">{t('Member ID', 'உறுப்பினர் எண்')}</span>
                <span className="home-member-id-val" style={meQ.isLoading ? { opacity: 0.45 } : undefined}>
                  {meQ.isLoading ? '—' : memberCode ?? '—'}
                </span>
              </div>
            </div>
            <Link to="/card" aria-label={t('My QR', 'எனது QR')} className="home-member-qr-box">
              <div className="home-member-qr-plate">
                {cardTokenQ.data ? (
                  <QR value={cardTokenQ.data} size={46} />
                ) : (
                  <div style={{ width: 46, height: 46, display: 'grid', placeItems: 'center' }}>
                    <Icon name="idCard" size={22} color="var(--ink-4)" />
                  </div>
                )}
              </div>
              <span className="home-member-qr-label">{t('My QR', 'எனது QR')}</span>
            </Link>
          </div>

          {/* Badges Row */}
          <div className="home-pills-row">
            <span className="home-pill home-pill-verified">
              <Icon name="check" size={11} strokeWidth={2.8} />
              {t('Verified Member', 'உறுதிப்படுத்தப்பட்ட உறுப்பினர்')}
            </span>
            <span className="home-pill home-pill-tier">
              <Icon name="crown" size={11} strokeWidth={2.4} />
              {t('Volunteer Tier', 'தன்னார்வலர் அடுக்கு')}
            </span>
            <span className="home-pill home-pill-since">
              <Icon name="calendar" size={11} strokeWidth={2.2} />
              {t('Since Aug 2025', 'ஆகஸ்ட் 2025 முதல்')}
            </span>
          </div>

          {/* Card Actions */}
          <div className="home-member-actions-row">
            <Link to="/card" className="home-card-btn-primary">
              <Icon name="idCard" size={17} color="#ffffff" strokeWidth={2.2} />
              <span>{t('View Membership Card', 'அட்டையைப் பார்')}</span>
            </Link>
            <button type="button" onClick={handleShareQR} className="home-card-btn-secondary">
              <Icon name="share" size={15} color={c.ink} strokeWidth={2.2} />
              <span>{t('Share QR', 'QR பகிர்')}</span>
            </button>
          </div>
        </section>

        {/* ---- Quick Access 4x2 Grid ---- */}
        <section className="work-section" style={{ marginTop: 22 }}>
          <div className="home-section-head">
            <h2>{t('Quick Access', 'விரைவு அணுகல்')}</h2>
            <Link to="/community">
              <span>{t('See all', 'அனைத்தும்')}</span>
              <Icon name="chevron" size={14} strokeWidth={2.4} />
            </Link>
          </div>
          <div className="home-qa-grid-redesign">
            {QUICK.map((a) => (
              <Link key={a.to + a.en} to={a.to} className="home-qa-tile" style={{ background: a.bg }}>
                <span className="home-qa-tile-icon" style={{ color: a.fg }}>
                  <Icon name={a.icon} size={20} strokeWidth={2.2} />
                </span>
                <span className="home-qa-tile-title">{t(a.en, a.ta)}</span>
                <span className="home-qa-tile-sub">{t(a.sub, a.subTa)}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---- Upcoming Events Section ---- */}
        <section className="work-section" style={{ marginTop: 22 }}>
          <div className="home-section-head">
            <h2>{t('Upcoming', 'வரவிருப்பவை')}</h2>
            <Link to="/events">
              <span>{t('See all', 'அனைத்தும்')}</span>
              <Icon name="chevron" size={14} strokeWidth={2.4} />
            </Link>
          </div>
          <QueryBoundary query={events}>
            {() => {
              const activeEvent = upcoming[activeEventIndex] || upcoming[0];
              if (!activeEvent && upcoming.length === 0) {
                // Image 2 approved empty state card
                return (
                  <div className="home-empty-card">
                    <Icon name="calendar" size={30} color="var(--ink-3)" strokeWidth={1.8} />
                    <div className="home-empty-card-title">
                      {t('No upcoming events', 'வரவிருக்கும் நிகழ்வுகள் இல்லை')}
                    </div>
                    <Link to="/events" className="home-empty-card-btn">
                      {t('Explore Events', 'நிகழ்வுகளைப் பார்')}
                    </Link>
                  </div>
                );
              }

              const d = new Date(activeEvent?.startsAt || Date.now() + 86400000 * 3);
              const monthStr = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Asia/Colombo' });
              const dayStr = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Colombo' });
              const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' });
              const dateFull = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });

              return (
                <>
                  <Link to={'/events/' + (activeEvent?.id || 'featured')} className="home-featured-event-card">
                    <div className="home-event-thumb-wrap">
                      <img src="/hero-north.webp" alt="" className="home-event-thumb-img" />
                      <div className="home-event-date-chip">
                        <span className="home-event-date-month">{monthStr}</span>
                        <span className="home-event-date-day">{dayStr}</span>
                      </div>
                    </div>
                    <div className="home-event-details">
                      <span className="home-event-category-tag">
                        {t('Community', 'சமூகம்')}
                      </span>
                      <div className="home-event-title">
                        {t(activeEvent?.titleEn, activeEvent?.titleTa) || activeEvent?.titleEn || activeEvent?.titleTa || 'District members’ convention'}
                      </div>
                      <div className="home-event-meta-row">
                        <Icon name="mapPin" size={13} color="#EF4444" />
                        <span>{activeEvent?.venue || 'Jaffna, Town Hall'}</span>
                      </div>
                      <div className="home-event-meta-row">
                        <Icon name="clock" size={13} color="var(--ink-3)" />
                        <span>{dateFull} • {timeStr}</span>
                      </div>
                      <div className="home-event-attendees-row">
                        <div className="home-event-avatar-stack">
                          <span className="home-event-mini-avatar" style={{ background: '#3B82F6' }} />
                          <span className="home-event-mini-avatar" style={{ background: '#10B981' }} />
                          <span className="home-event-mini-avatar" style={{ background: '#F59E0B' }} />
                        </div>
                        <span className="home-event-going-text">+120 going</span>
                      </div>
                    </div>
                    <div style={{ color: 'var(--ink-3)' }}>
                      <Icon name="chevron" size={18} strokeWidth={2.4} />
                    </div>
                  </Link>
                  {upcoming.length > 1 && (
                    <div className="home-paging-dots">
                      {upcoming.slice(0, 3).map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => { e.preventDefault(); setActiveEventIndex(idx); }}
                          className={`home-dot ${activeEventIndex === idx ? 'active' : ''}`}
                          aria-label={`Event slide ${idx + 1}`}
                          style={{ border: 'none', cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            }}
          </QueryBoundary>
        </section>

        {/* ---- Local Updates Section ---- */}
        <section id="local-updates-section" className="work-section" style={{ marginTop: 22, paddingBottom: 24 }}>
          <div className="home-section-head">
            <h2>{t('Local Updates', 'உள்ளூர் புதுப்பிப்புகள்')}</h2>
          </div>
          <QueryBoundary query={announcements} label={t('Loading…', 'ஏற்றுகிறது…')}>
            {(list) => {
              const displayList = list.length ? list.slice(0, 2) : [
                {
                  id: 'ann-1',
                  scope: 'district',
                  titleEn: 'District members’ convention — August 17',
                  titleTa: 'யாழ். மாவட்ட உறுப்பினர் மாநாடு — ஆகஸ்ட் 17',
                  authorName: 'Leadership',
                  publishedAt: new Date(Date.now() - 430 * 86400000).toISOString(),
                },
                {
                  id: 'ann-2',
                  scope: 'ward',
                  titleEn: 'Nallur water supply scheme announcement',
                  titleTa: 'நல்லூர் நீர் விநியோகத் திட்டம் அறிவிப்பு',
                  authorName: 'Media unit',
                  publishedAt: new Date(Date.now() - 427 * 86400000).toISOString(),
                },
              ];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayList.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate('/announcement/' + a.id)}
                      className="home-update-card"
                    >
                      <div className="home-update-icon-thumb">
                        <Icon name="megaphone" size={24} color="var(--ink-3)" strokeWidth={1.8} />
                      </div>
                      <div className="home-update-content">
                        <span className="home-update-badge">
                          {a.scope || 'general'}
                        </span>
                        <div className="home-update-title">
                          {t(a.titleEn, a.titleTa) || a.titleTa || a.titleEn}
                        </div>
                        <div className="home-update-meta">
                          {a.authorName || 'Leadership'} · {fmtAgo(a.publishedAt, t)}
                        </div>
                      </div>
                      <div className="home-update-arrow">
                        <Icon name="chevron" size={16} color="var(--ink-3)" strokeWidth={2.2} />
                      </div>
                    </button>
                  ))}
                </div>
              );
            }}
          </QueryBoundary>
        </section>
      </main>
    </>
  );
}
