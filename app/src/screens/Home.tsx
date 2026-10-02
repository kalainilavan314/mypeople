import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { c, font } from '../theme/tokens';
import { useMe } from '../hooks/useMe';
import { useEvents, useAnnouncements } from '../data/queries';
import { authApi } from '../data/authApi';
import { QueryBoundary } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { QR } from '../lib/qr';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { HomeTopBar } from '../components/HomeTopBar';

/* ============================================================== Home
   Civic-service home: brand bar, a calm regional hero, one membership summary
   card (with the real signed QR), a pastel Quick Access grid, live upcoming
   events and real local announcements. Presentation only — every route, data
   source and action is preserved. */

// Quick Access — existing destinations, each with a restrained pastel tile.
const QUICK: { to: string; icon: IconName; en: string; ta: string; sub: string; subTa: string; bg: string; fg: string }[] = [
  { to: '/area', icon: 'mapPin', en: 'My Area', ta: 'எனது பகுதி', sub: 'Local info & updates', subTa: 'உள்ளூர் தகவல்', bg: '#EEF5FF', fg: '#3B82F6' },
  { to: '/reports', icon: 'report', en: 'Report Issue', ta: 'பிரச்சினை', sub: 'Raise community issues', subTa: 'சமூகப் பிரச்சினை', bg: '#FFF5E8', fg: '#B7791F' },
  { to: '/events', icon: 'calendar', en: 'Events', ta: 'நிகழ்வுகள்', sub: 'Upcoming events', subTa: 'வரவிருப்பவை', bg: '#EDF4FF', fg: '#3B82F6' },
  { to: '/skills', icon: 'handHeart', en: 'Volunteer', ta: 'தன்னார்வம்', sub: 'Contribute your skills', subTa: 'திறன்களை வழங்குக', bg: '#EAF7F2', fg: '#16835D' },
  { to: '/card', icon: 'idCard', en: 'Membership', ta: 'உறுப்பினர்', sub: 'View your card', subTa: 'அட்டையைப் பார்', bg: '#F2F4F7', fg: '#14263D' },
  { to: '/survey', icon: 'clipboard', en: 'Surveys', ta: 'கருத்துக்கணிப்பு', sub: 'Share your opinion', subTa: 'கருத்தைப் பகிர்', bg: '#EEF2F7', fg: '#315B82' },
  { to: '/courses', icon: 'book', en: 'Learning', ta: 'கற்றல்', sub: 'Build new skills', subTa: 'திறன்களை வளர்', bg: '#EEF4FF', fg: '#3B82F6' },
  { to: '/community', icon: 'users', en: 'Community', ta: 'சமூகம்', sub: 'Connect & participate', subTa: 'இணைந்து பங்கேற்க', bg: '#EAF7F2', fg: '#16835D' },
];

function verify(t: (en: string, ta: string) => string, s?: string): { label: string; good: boolean } {
  // `good` → green pill with a check (a passed/completed check). Honest: a
  // pending review or an unverified member is never shown green.
  if (s === 'identity_confirmed') return { label: t('Identity verified', 'அடையாளம் உறுதி'), good: true };
  if (s === 'review_pending') return { label: t('Review pending', 'மதிப்பாய்வு நிலுவை'), good: false };
  if (s === 'nic_format') return { label: t('NIC format checked', 'தே.அ.அ சரிபார்'), good: true };
  return { label: t('Not verified', 'சரிபார்க்கப்படவில்லை'), good: false };
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
  const me = useMe();
  const navigate = useNavigate();
  const events = useEvents();
  const announcements = useAnnouncements();
  const t = useWorkspaceText();

  const cardTokenQ = useQuery({
    queryKey: ['cardToken'],
    queryFn: () => authApi.cardToken(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
  });

  const upcoming = (events.data ?? [])
    .filter((e) => Date.parse(e.startsAt) >= Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const v = verify(t, me?.verificationStatus);
  const firstName = me ? me.fullName.split(' ')[0] : '';

  return (
    <>
      <HomeTopBar />
      <main className="workspace" style={{ paddingTop: 'calc(66px + var(--safe-top, 0px))' }}>
        {/* ---- Hero (regional cover image + welcome) ---- */}
        <section className="home-hero" aria-label={t('Welcome', 'வரவேற்பு')}>
          <div className="home-hero-overlay" aria-hidden="true" />
          <div className="home-hero-text">
            <p style={{ font: `700 15px/1.4 ${font.ui}`, color: c.ink, margin: 0 }}>
              {t('Hello', 'வணக்கம்')}{firstName ? ', ' + firstName : ''}
            </p>
            <h1 style={{ font: `800 28px/1.14 ${font.head}`, letterSpacing: '-0.015em', color: c.ink0, margin: '7px 0 0' }}>
              {t('Together for', 'ஒன்றாக')}<br />{t('stronger communities', 'வலிமையான சமூகங்கள்')}
            </h1>
            <p style={{ font: `500 13.5px/1.5 ${font.ui}`, color: c.ink, margin: '9px 0 0', maxWidth: 250 }}>
              {t('Your membership, community services, events and local updates — all in one place.', 'உங்கள் உறுப்பினர், சேவைகள், நிகழ்வுகள் மற்றும் புதுப்பிப்புகள் ஒரே இடத்தில்.')}
            </p>
          </div>
        </section>

        {/* ---- Membership summary card (overlaps hero) ---- */}
        <section className="home-member home-member-hero">
          <div className="home-member-head">
            <span className="home-member-eyebrow">{t('YOUR MEMBERSHIP', 'உங்கள் உறுப்பினர்')}</span>
            <span className={`home-verify${v.good ? ' is-verified' : ''}`}>
              <Icon name={v.good ? 'check' : 'info'} size={13} strokeWidth={2.4} />
              {v.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 10 }}>
            <span style={{ flex: 'none', width: 56, height: 56, borderRadius: 999, overflow: 'hidden', background: c.surfaceVariant, display: 'grid', placeItems: 'center' }}>
              {me?.avatarUrl ? <img src={me.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={26} color={c.ink4} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: `700 19px/1.2 ${font.head}`, color: c.ink0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.fullName || '—'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <span style={{ font: `600 11px/1 ${font.ui}`, letterSpacing: '.04em', color: c.ink2 }}>{t('Member ID', 'உறுப்பினர் எண்')}</span>
                <span style={{ font: `700 13px/1 ${font.mono}`, color: c.ink0 }}>{me?.memberCode || '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, font: `500 13px/1.4 ${font.ta}`, color: c.ink2 }}>
                <Icon name="mapPin" size={13} color={c.ink3} strokeWidth={2} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[me?.districtName, me?.gsName].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
            </div>
            <Link to="/card" aria-label={t('My QR', 'எனது QR')} style={{ flex: 'none', textDecoration: 'none', textAlign: 'center' }}>
              <span style={{ display: 'block', background: '#fff', border: `1px solid ${c.hairline}`, borderRadius: 10, padding: 6 }}>
                {cardTokenQ.data ? <QR value={cardTokenQ.data} size={54} /> : <span style={{ width: 54, height: 54, display: 'grid', placeItems: 'center' }}><Icon name="idCard" size={22} color={c.ink4} /></span>}
              </span>
              <span style={{ display: 'block', font: `600 10px/1 ${font.ui}`, color: c.ink3, marginTop: 4 }}>{t('My QR', 'எனது QR')}</span>
            </Link>
          </div>

          <div className="home-member-actions">
            <Link to="/card" className="mp-btn mp-btn-primary">
              <Icon name="idCard" size={17} color="#fff" /> {t('View Membership Card', 'அட்டையைப் பார்')}
            </Link>
            <Link to="/card" className="mp-btn mp-btn-secondary" aria-label={t('View QR code', 'QR குறியீடு')}>
              <Icon name="idCard" size={16} /> {t('QR', 'QR')}
            </Link>
          </div>
        </section>

        {/* ---- Quick Access ---- */}
        <section className="work-section">
          <h2>{t('Quick Access', 'விரைவு அணுகல்')}</h2>
          <div className="home-qa-grid">
            {QUICK.map((a) => (
              <Link key={a.to + a.en} to={a.to} className="home-qa" style={{ background: a.bg }}>
                <span className="home-qa-ic" style={{ background: '#fff', color: a.fg }}>
                  <Icon name={a.icon} size={22} strokeWidth={1.9} />
                </span>
                <span className="home-qa-title">{t(a.en, a.ta)}</span>
                <span className="home-qa-sub">{t(a.sub, a.subTa)}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---- Coming Up ---- */}
        <section className="work-section">
          <div className="work-section-head">
            <h2>{t('Coming up', 'வரவிருப்பவை')}</h2>
            <Link to="/events">{t('All events', 'அனைத்தும்')}</Link>
          </div>
          <QueryBoundary query={events}>
            {() =>
              upcoming.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {upcoming.slice(0, 3).map((e) => {
                    const d = new Date(e.startsAt);
                    return (
                      <Link key={e.id} to={'/events/' + e.id} className="home-event">
                        <span className="home-date">
                          <strong>{d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Colombo' })}</strong>
                          <span>{d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Asia/Colombo' })}</span>
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', font: `600 15px/1.3 ${font.ta}`, color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(e.titleEn, e.titleTa) || e.titleEn || e.titleTa}</span>
                          <span style={{ display: 'block', font: `400 12px/1.4 ${font.ui}`, color: c.ink3, marginTop: 3 }}>{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })} · {e.venue}</span>
                        </span>
                        <Icon name="chevron" size={16} color={c.ink3} />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="home-empty">
                  <Icon name="calendar" size={26} color={c.ink3} />
                  <div style={{ font: `600 15px/1.4 ${font.ta}`, color: c.ink }}>{t('No upcoming events', 'வரவிருக்கும் நிகழ்வுகள் இல்லை')}</div>
                  <Link to="/events" className="mp-btn mp-btn-secondary" style={{ marginTop: 8 }}>{t('Explore Events', 'நிகழ்வுகளைப் பார்')}</Link>
                </div>
              )
            }
          </QueryBoundary>
        </section>

        {/* ---- Local Updates ---- */}
        <QueryBoundary query={announcements} label={t('Loading…', 'ஏற்றுகிறது…')}>
          {(list) =>
            list.length ? (
              <section className="work-section">
                <h2>{t('Local Updates', 'உள்ளூர் புதுப்பிப்புகள்')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {list.slice(0, 3).map((a) => (
                    <button key={a.id} onClick={() => navigate('/announcement/' + a.id)} className="home-update">
                      {a.photoUrl ? (
                        <img src={a.photoUrl} alt="" loading="lazy" className="home-update-thumb" />
                      ) : (
                        <span className="home-update-thumb" style={{ display: 'grid', placeItems: 'center', background: c.surfaceVariant }}><Icon name="megaphone" size={22} color={c.ink4} /></span>
                      )}
                      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        {a.scope && <span style={{ display: 'inline-block', font: `600 10px/1 ${font.ui}`, color: c.secondary, background: c.secondaryContainer, padding: '4px 8px', borderRadius: 999 }}>{a.scope}</span>}
                        <span style={{ font: `600 14px/1.35 ${font.ta}`, color: c.ink, marginTop: a.scope ? 6 : 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t(a.titleEn, a.titleTa)}</span>
                        <span style={{ display: 'block', font: `400 12px/1.4 ${font.ui}`, color: c.ink3, marginTop: 4 }}>{a.authorName} · {fmtAgo(a.publishedAt, t)}</span>
                      </span>
                      <Icon name="chevron" size={16} color={c.ink3} />
                    </button>
                  ))}
                </div>
              </section>
            ) : null
          }
        </QueryBoundary>
      </main>
    </>
  );
}
