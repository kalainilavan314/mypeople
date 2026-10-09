import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { useMe } from '../hooks/useMe';
import { useMember } from '../data/queries';

/* ============================================================== Community Redesign
   Matching modern UI mockup with:
   - Header with bilingual eyebrow & search/filter actions
   - My Area hero banner with district/DS/GN glass overlay + map pin
   - "Get Involved" 2x3 grid with vibrant soft-tinted cards
   - "Explore & Learn" list
==================================================================================== */

type InvolvedItem = {
  to: string;
  icon: IconName;
  bg: string;
  color: string;
  glow: string;
  en: [string, string];
  ta: [string, string];
};

// Restrained palette (spec §2.1): every service tile uses the same navy icon on
// soft-blue — the icon + label carry the meaning, not colour (WCAG 1.4.1).
const TILE_BG = 'var(--soft-blue)';
const TILE_FG = 'var(--primary)';
const INVOLVED_TILES: InvolvedItem[] = [
  {
    to: '/reports',
    icon: 'report',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Community reporting', 'Submit an issue and follow its status'],
    ta: ['சமூக அறிக்கை', 'பிரச்சினையைப் பதிவு செய்து நிலையைப் பாருங்கள்'],
  },
  {
    to: '/skills',
    icon: 'handHeart',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Volunteer', 'Offer your skills and time locally'],
    ta: ['தன்னார்வ சேவை', 'உங்கள் திறனையும் நேரத்தையும் வழங்குங்கள்'],
  },
  {
    to: '/events',
    icon: 'calendar',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Local activities', 'Meetings and events near you'],
    ta: ['உள்ளூர் நிகழ்வுகள்', 'உங்கள் பகுதியில் கூட்டங்களும் நிகழ்வுகளும்'],
  },
  {
    to: '/fund',
    icon: 'coins',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Party Fund', 'Contribute to movement operations'],
    ta: ['கட்சி நிதி', 'இயக்கச் செயற்பாடுகளுக்கு பங்களியுங்கள்'],
  },
  {
    to: '/referral',
    icon: 'users',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Invite a member', 'Share your referral and grow the roll'],
    ta: ['உறுப்பினரை அழையுங்கள்', 'உங்கள் பரிந்துரைக் குறியீட்டைப் பகிருங்கள்'],
  },
  {
    to: '/gallery',
    icon: 'image',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Community gallery', 'Photos from across the five districts'],
    ta: ['சமூகப் படங்கள்', 'ஐந்து மாவட்டங்களிலிருந்து படங்கள்'],
  },
];

type ExploreItem = {
  to: string;
  icon: IconName;
  bg: string;
  color: string;
  en: [string, string];
  ta: [string, string];
};

const EXPLORE_TILES: ExploreItem[] = [
  {
    to: '/ideas',
    icon: 'bulb',
    bg: TILE_BG,
    color: TILE_FG,
    en: ['Community ideas', 'Share and explore ideas for a better tomorrow'],
    ta: ['சமூகக் கருத்துகள்', 'சிறந்த நாளைக்கான கருத்துகளைப் பகிருங்கள்'],
  },
  {
    to: '/survey',
    icon: 'trending',
    bg: TILE_BG,
    color: TILE_FG,
    en: ['Surveys', 'Your opinion shapes change'],
    ta: ['கருத்துக்கணிப்புகள்', 'உங்கள் கருத்து மாற்றத்தை உருவாக்கும்'],
  },
  {
    to: '/courses',
    icon: 'gradCap',
    bg: TILE_BG,
    color: TILE_FG,
    en: ['Learning', 'Resources and knowledge for our community'],
    ta: ['கற்றல்', 'எங்கள் சமூகத்திற்கான வளங்களும் அறிவும்'],
  },
];

export function Community() {
  const t = useWorkspaceText();
  const lang: 'en' | 'ta' = t('en', 'ta') as 'en' | 'ta';
  const me = useMe();
  const memberQ = useMember();

  const district = me?.districtName ?? memberQ.data?.electorateNameEn ?? 'Jaffna District';
  const ds = me?.dsName ?? 'Chavakachcheri DS';
  const gs = me?.gsName ?? 'Alaveddy GN';

  return (
    <main className="workspace" style={{ paddingBottom: 80 }}>
      {/* ---- Header ---- */}
      <header className="cm-head-redesign">
        <div>
          <div className="cm-eyebrow-row">
            <Icon name="users" size={17} color="var(--accent)" strokeWidth={2.4} />
            <span>My People / என் மக்கள்</span>
          </div>
          <h1 className="cm-title">{t('Community', 'Community')}</h1>
          <p className="cm-sub-ta">நம் மக்கள். நம் பகுதி. நம் முன்னேற்றம்.</p>
          <p className="cm-sub-en">
            {t('Your local connections, opportunities and participation.', 'Your local connections, opportunities and participation.')}
          </p>
        </div>
        <div className="cm-actions-group">
          <Link
            className="cm-action-circle-btn"
            to="/events"
            aria-label={t('Search', 'தேடுங்கள்')}
          >
            <Icon name="search" size={18} strokeWidth={2.2} />
          </Link>
          <Link
            className="cm-action-circle-btn"
            to="/area"
            aria-label={t('Filters', 'வடிகட்டிகள்')}
          >
            <Icon name="sliders" size={18} strokeWidth={2.2} />
          </Link>
        </div>
      </header>

      {/* ---- MY AREA Hero Banner Card ---- */}
      <section className="cm-hero-banner">
        <div className="cm-hero-banner-overlay" aria-hidden="true" />

        <div className="cm-hero-left">
          <div>
            <div className="cm-hero-badge">
              <span className="cm-hero-badge-icon">
                <Icon name="shield" size={11} color="#ffffff" strokeWidth={2.5} />
              </span>
              <span>{t('MY AREA', 'MY AREA')}</span>
            </div>
            <h2 className="cm-hero-h2">
              {t('Your district, DS and GN connection', 'Your district, DS and GN connection')}
            </h2>
            <p className="cm-hero-desc">
              {t(
                'Access local information, representatives, services and key updates for your area.',
                'Access local information, representatives, services and key updates for your area.'
              )}
            </p>
          </div>
          <Link to="/area" className="cm-hero-cta">
            <span>{t('View my area', 'View my area')}</span>
            <Icon name="arrowRight" size={14} strokeWidth={2.5} />
          </Link>
        </div>

        <div className="cm-hero-right">
          <div className="cm-location-glass-box">
            <div className="cm-location-item">
              <Icon name="landmark" size={13} color="#ffffff" strokeWidth={2} />
              <span>{district}</span>
            </div>
            <div className="cm-location-item">
              <Icon name="user" size={13} color="#ffffff" strokeWidth={2} />
              <span>{ds}</span>
            </div>
            <div className="cm-location-item">
              <Icon name="mapPin" size={13} color="#ffffff" strokeWidth={2} />
              <span>{gs}</span>
            </div>
          </div>

          <div className="cm-hero-map-pin">
            <Icon name="mapPin" size={18} color="var(--accent)" strokeWidth={2.5} />
          </div>
        </div>
      </section>

      {/* ---- Get Involved Section ---- */}
      <section>
        <div className="cm-section-header-row">
          <div className="cm-section-title-wrap">
            <span className="cm-section-bar-pill" aria-hidden="true" />
            <h2 className="cm-section-heading">{t('Get Involved', 'Get Involved')}</h2>
          </div>
          <Link to="/events" className="cm-section-see-all">
            <span>{t('See all', 'See all')}</span>
            <Icon name="arrowRight" size={13} strokeWidth={2.4} />
          </Link>
        </div>
        <p className="cm-section-subtext">
          {t('Take part, make a difference in your community.', 'Take part, make a difference in your community.')}
        </p>

        <div className="cm-involved-grid">
          {INVOLVED_TILES.map((tile) => {
            const [title, detail] = tile[lang];
            return (
              <Link key={tile.to} to={tile.to} className="cm-involved-card">
                <div
                  className="cm-involved-card-glow"
                  style={{ background: tile.glow }}
                  aria-hidden="true"
                />
                <div className="cm-involved-top">
                  <div
                    className="cm-involved-icon-wrap"
                    style={{ background: tile.bg, color: tile.color }}
                  >
                    <Icon name={tile.icon} size={20} strokeWidth={2} />
                  </div>
                  <div className="cm-involved-chevron">
                    <Icon name="chevron" size={13} color="#94A3B8" strokeWidth={2.4} />
                  </div>
                </div>
                <div className="cm-involved-content">
                  <h3 className="cm-involved-title">{title}</h3>
                  <p className="cm-involved-sub">{detail}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- Explore & Learn Section ---- */}
      <section>
        <div className="cm-section-header-row">
          <div className="cm-section-title-wrap">
            <Icon name="book" size={18} color="var(--accent)" strokeWidth={2.2} />
            <h2 className="cm-section-heading">{t('Explore & Learn', 'Explore & Learn')}</h2>
          </div>
          <Link to="/ideas" className="cm-section-see-all">
            <span>{t('See all', 'See all')}</span>
            <Icon name="arrowRight" size={13} strokeWidth={2.4} />
          </Link>
        </div>
        <p className="cm-section-subtext">
          {t('Ideas, surveys and learning for a stronger community.', 'Ideas, surveys and learning for a stronger community.')}
        </p>

        <div className="cm-explore-list">
          {EXPLORE_TILES.map((tile) => {
            const [title, detail] = tile[lang];
            return (
              <Link key={tile.to} to={tile.to} className="cm-explore-card">
                <div
                  className="cm-explore-icon-wrap"
                  style={{ background: tile.bg, color: tile.color }}
                >
                  <Icon name={tile.icon} size={20} strokeWidth={2} />
                </div>
                <div className="cm-explore-content">
                  <strong className="cm-explore-title">{title}</strong>
                  <span className="cm-explore-sub">{detail}</span>
                </div>
                <Icon name="chevron" size={16} color="#94A3B8" strokeWidth={2} />
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
