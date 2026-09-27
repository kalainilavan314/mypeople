import { Link } from 'react-router-dom';
import { useMe } from '../hooks/useMe';
import { useEvents, useMyCommunityReports } from '../data/queries';
import { QueryBoundary } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { PalmyraMark } from '../components/PalmyraMark';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { HomeTopBar } from '../components/HomeTopBar';

/* ============================================================== Home
   Civic super-app home (UMANG / LifeSG pattern): a personalised greeting, a
   branded hero, a colour-coded quick-action grid, then live sections. Colour
   is used with meaning — one saturated hue per destination — over deep,
   WCAG-AA tile fills with white glyphs. */

// One deliberate colour per destination (deep, accessible — white icon ≥ 4.5:1).
const ACTIONS: { to: string; icon: IconName; en: string; ta: string; color: string }[] = [
  { to: '/card', icon: 'idCard', en: 'My Card', ta: 'அட்டை', color: '#14263D' },
  { to: '/events', icon: 'calendar', en: 'Events', ta: 'நிகழ்வுகள்', color: '#1D4ED8' },
  { to: '/reports', icon: 'report', en: 'Report', ta: 'அறிக்கை', color: '#B45309' },
  { to: '/skills', icon: 'handHeart', en: 'Volunteer', ta: 'தன்னார்வம்', color: '#15803D' },
  { to: '/fund', icon: 'heart', en: 'Party Fund', ta: 'நிதி', color: '#BE123C' },
  { to: '/community', icon: 'users', en: 'Community', ta: 'சமூகம்', color: '#0F766E' },
  { to: '/gallery', icon: 'image', en: 'Gallery', ta: 'படங்கள்', color: '#7C3AED' },
  { to: '/area', icon: 'mapPin', en: 'My Area', ta: 'எனது பகுதி', color: '#0E7490' },
];

export function Home() {
  const me = useMe();
  const events = useEvents();
  const reports = useMyCommunityReports();
  const t = useWorkspaceText();

  const upcoming = (events.data ?? [])
    .filter((e) => Date.parse(e.startsAt) >= Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const open = (reports.data ?? []).filter((r) => r.status !== 'resolved');

  return (
    <>
      <HomeTopBar />
      <main className="workspace">
        <header className="work-heading">
          <span className="work-eyebrow">{t('MY PEOPLE · MEMBER SPACE', 'என் மக்கள் · உறுப்பினர் பகுதி')}</span>
          <h1>{t('Welcome', 'வணக்கம்')}{me ? ', ' + me.fullName.split(' ')[0] : ''}</h1>
          <p>{[me?.districtName, me?.dsName].filter(Boolean).join(' · ') || t('Your community, connected.', 'உங்கள் சமூகத்துடன் இணையுங்கள்.')}</p>
        </header>

        {/* ---- Branded hero ---- */}
        <section className="home-hero">
          <PalmyraMark size={190} stroke="#FFFFFF" opacity={0.12} style={{ position: 'absolute', right: -30, top: -26 }} />
          <div style={{ position: 'relative' }}>
            <span className="home-hero-badge">{t('OUR MISSION', 'எமது நோக்கம்')}</span>
            <div className="ta home-hero-title">இலக்கு ஒன்று தான் — இனத்தின் விடிவு</div>
            <div className="home-hero-sub">{t('One goal — the rise of our people, across the North and East.', 'ஒரே இலக்கு — வடக்கு, கிழக்கு மக்களின் விடிவு.')}</div>
            <Link to="/area" className="home-hero-cta">
              {me?.gsName ? t('My local area', 'எனது பகுதி') : t('Set up my area', 'எனது பகுதியை அமைக்க')}
              <Icon name="chevron" size={16} />
            </Link>
          </div>
        </section>

        {/* ---- Quick actions (colour-coded grid) ---- */}
        <section className="work-section" style={{ marginTop: 24 }}>
          <h2>{t('Quick actions', 'விரைவு செயல்கள்')}</h2>
          <div className="home-grid">
            {ACTIONS.map((a) => (
              <Link key={a.to} to={a.to} className="home-tile">
                <span className="home-tile-icon" style={{ background: a.color }}>
                  <Icon name={a.icon} size={22} color="#fff" strokeWidth={2} />
                </span>
                <span className={t('en', 'ta') === 'ta' ? 'ta' : undefined}>{t(a.en, a.ta)}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---- Your next steps ---- */}
        <section className="work-section">
          <div className="work-section-head">
            <h2>{t('Your next steps', 'அடுத்த நடவடிக்கைகள்')}</h2>
          </div>
          <div className="work-panel">
            <StepLink to="/card" icon="idCard" color="#14263D" title={t('Membership card', 'உறுப்பினர் அட்டை')} detail={me?.memberCode || t('View your member identity', 'உறுப்பினர் அடையாளத்தைப் பார்க்கவும்')} />
            <StepLink to="/reports" icon="report" color="#B45309" title={t('Community reports', 'சமூக அறிக்கைகள்')} detail={reports.isError ? t('Status unavailable — open to retry', 'நிலையைப் பெற முடியவில்லை') : reports.isLoading ? t('Loading your reports…', 'ஏற்றப்படுகிறது…') : t(open.length + ' of your reports are open', open.length + ' அறிக்கைகள் நிலுவையில் உள்ளன')} />
            <StepLink to="/skills" icon="handHeart" color="#15803D" title={t('Volunteer skills', 'தன்னார்வத் திறன்கள்')} detail={t('Choose how you can contribute', 'உங்கள் பங்களிப்பைத் தேர்ந்தெடுங்கள்')} />
          </div>
        </section>

        {/* ---- Coming up ---- */}
        <section className="work-section">
          <div className="work-section-head">
            <h2>{t('Coming up', 'வரவிருப்பவை')}</h2>
            <Link to="/events">{t('All activities', 'அனைத்து நிகழ்வுகள்')}</Link>
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
                <p className="work-empty">{t('No upcoming activities have been published.', 'வரவிருக்கும் நிகழ்வுகள் இன்னும் வெளியிடப்படவில்லை.')}</p>
              )
            }
          </QueryBoundary>
        </section>
      </main>
    </>
  );
}

function StepLink({ to, icon, color, title, detail }: { to: string; icon: IconName; color: string; title: string; detail: string }) {
  return (
    <Link className="work-link" to={to}>
      <span className="work-icon" style={{ background: color + '1a', color }}>
        <Icon name={icon} size={20} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <Icon name="chevron" size={16} />
    </Link>
  );
}
