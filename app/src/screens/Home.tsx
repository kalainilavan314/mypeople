import { Link } from 'react-router-dom';
import { c, font } from '../theme/tokens';
import { useMe } from '../hooks/useMe';
import { useEvents } from '../data/queries';
import { QueryBoundary } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { HomeTopBar } from '../components/HomeTopBar';

/* ============================================================== Home
   Civic-service home per the My People design system: calm greeting, one
   featured membership card, a Quick Access grid with subtle (not saturated)
   icon containers, then live sections. Clarity > decoration. */

// Restrained, semantic icon colours — rendered as a light tint behind a line
// icon, never as a saturated fill.
const QUICK: { to: string; icon: IconName; en: string; ta: string; color: string }[] = [
  { to: '/area', icon: 'mapPin', en: 'My Area', ta: 'எனது பகுதி', color: '#315B82' },
  { to: '/reports', icon: 'report', en: 'Report Issue', ta: 'பிரச்சினை', color: '#B7791F' },
  { to: '/events', icon: 'calendar', en: 'Events', ta: 'நிகழ்வுகள்', color: '#3B82F6' },
  { to: '/skills', icon: 'handHeart', en: 'Volunteer', ta: 'தன்னார்வம்', color: '#19764B' },
  { to: '/card', icon: 'idCard', en: 'Membership', ta: 'உறுப்பினர்', color: '#14263D' },
  { to: '/survey', icon: 'clipboard', en: 'Surveys', ta: 'கருத்துக்கணிப்பு', color: '#315B82' },
  { to: '/courses', icon: 'book', en: 'Learning', ta: 'கற்றல்', color: '#3B82F6' },
  { to: '/community', icon: 'users', en: 'Community', ta: 'சமூகம்', color: '#19764B' },
];

function verifyText(t: (en: string, ta: string) => string, s?: string) {
  if (s === 'identity_confirmed') return t('Identity verified', 'அடையாளம் உறுதி');
  if (s === 'review_pending') return t('Review pending', 'மதிப்பாய்வு நிலுவை');
  if (s === 'nic_format') return t('NIC format checked', 'தே.அ.அ சரிபார்');
  return t('Not verified', 'சரிபார்க்கப்படவில்லை');
}

export function Home() {
  const me = useMe();
  const events = useEvents();
  const t = useWorkspaceText();

  const upcoming = (events.data ?? [])
    .filter((e) => Date.parse(e.startsAt) >= Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const confirmed = me?.verificationStatus === 'identity_confirmed';

  return (
    <>
      <HomeTopBar />
      <main className="workspace">
        <header style={{ marginBottom: 16 }}>
          <p style={{ font: `400 14px/1.4 ${font.ui}`, color: c.ink3, margin: 0 }}>
            {t('Hello', 'வணக்கம்')}{me ? ', ' + me.fullName.split(' ')[0] : ''}
          </p>
          <h1 style={{ font: `700 24px/1.3 ${font.head}`, letterSpacing: '-0.01em', color: c.ink0, margin: '6px 0 0' }}>
            {t('Together for stronger communities', 'வலிமையான சமூகங்களுக்காக ஒன்றாக')}
          </h1>
          <p style={{ font: `400 14px/1.5 ${font.ui}`, color: c.ink3, margin: '8px 0 0' }}>
            {t('Your membership, community services, events and local updates — all in one place.', 'உங்கள் உறுப்பினர், சமூக சேவைகள், நிகழ்வுகள் மற்றும் உள்ளூர் புதுப்பிப்புகள் ஒரே இடத்தில்.')}
          </p>
        </header>

        {/* ---- Featured membership card ---- */}
        <section className="home-member">
          <div className="home-member-head">
            <span className="home-member-eyebrow">{t('YOUR MEMBERSHIP', 'உங்கள் உறுப்பினர்')}</span>
            <span className={`home-verify${confirmed ? ' is-verified' : ''}`}>
              <Icon name={confirmed ? 'check' : 'info'} size={13} strokeWidth={2.2} />
              {verifyText(t, me?.verificationStatus)}
            </span>
          </div>
          <MemberRow label={t('Member ID', 'உறுப்பினர் எண்')} value={me?.memberCode || '—'} mono />
          <MemberRow label={t('District', 'மாவட்டம்')} value={[me?.districtName, me?.gsName].filter(Boolean).join(' · ') || '—'} />
          <div className="home-member-actions">
            <Link to="/card" className="mp-btn mp-btn-primary">{t('View Membership Card', 'அட்டையைப் பார்')}</Link>
            <Link to="/card" className="mp-btn mp-btn-secondary" aria-label={t('View QR code', 'QR குறியீடு')}>
              <Icon name="idCard" size={16} /> {t('QR', 'QR')}
            </Link>
          </div>
        </section>

        {/* ---- Quick Access ---- */}
        <section className="work-section">
          <h2>{t('Quick Access', 'விரைவு அணுகல்')}</h2>
          <div className="home-grid">
            {QUICK.map((a) => (
              <Link key={a.to + a.en} to={a.to} className="home-tile">
                <span className="home-tile-icon" style={{ background: a.color + '14', color: a.color }}>
                  <Icon name={a.icon} size={22} strokeWidth={1.9} />
                </span>
                <span className={t('en', 'ta') === 'ta' ? 'ta' : undefined}>{t(a.en, a.ta)}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---- Coming up ---- */}
        <section className="work-section">
          <div className="work-section-head">
            <h2>{t('Coming up', 'வரவிருப்பவை')}</h2>
            <Link to="/events">{t('All events', 'அனைத்தும்')}</Link>
          </div>
          <QueryBoundary query={events}>
            {() =>
              upcoming.length ? (
                <div className="work-panel">
                  {upcoming.slice(0, 3).map((e) => (
                    <Link className="work-event" key={e.id} to={'/events/' + e.id}>
                      <time dateTime={e.startsAt}>
                        <strong>{new Date(e.startsAt).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Colombo' })}</strong>
                        <span>{new Date(e.startsAt).toLocaleDateString('en-GB', { month: 'short', timeZone: 'Asia/Colombo' })}</span>
                      </time>
                      <div>
                        <strong>{t(e.titleEn, e.titleTa) || e.titleEn || e.titleTa}</strong>
                        <small>{e.venue}</small>
                        <small>{new Date(e.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })} · {t('Sri Lanka time', 'இலங்கை நேரம்')}</small>
                      </div>
                      <Icon name="chevron" size={16} />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="work-empty">{t('No upcoming events yet.', 'வரவிருக்கும் நிகழ்வுகள் இல்லை.')}</p>
              )
            }
          </QueryBoundary>
        </section>
      </main>
    </>
  );
}

function MemberRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="home-member-row">
      <span style={{ font: `400 13px/1.4 ${font.ui}`, color: c.ink3 }}>{label}</span>
      <span style={{ font: `600 13px/1.4 ${mono ? font.mono : font.ui}`, color: c.ink, textAlign: 'right', minWidth: 0 }}>{value}</span>
    </div>
  );
}
