import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { useWorkspaceText } from '../components/MemberWorkspace';

/* ============================================================== Community

   Everything a member can take part in, in one place.

   The approved mockup tinted each of the six tiles a different pastel hue. That
   was rejected and the rejection is right: what actually distinguishes
   "Volunteer" from "Party Fund" is the icon and the words. Hue was a seventh
   signal layered on top of two that already worked, and six arbitrary hues is
   the thing that makes an interface look generated rather than designed.

   So nothing on this screen is differentiated by colour. Depth carries the
   hierarchy instead — see the plane ladder in global.css. The navy accent is
   spent on exactly three things: the My Area hero, the two promoted tile icons,
   and one 3px rule beside the section heading.

   Two of the six tiles are promoted, and which two is a judgement, not styling:
   reporting and volunteering are what turn a member from an audience into a
   participant. Party Fund is deliberately NOT promoted — a civic membership app
   whose visual hierarchy leads with money reads as extractive.
*/

type Tile = {
  to: string;
  icon: IconName;
  en: [string, string];
  ta: [string, string];
  lead?: boolean;
};

const TILES: Tile[] = [
  {
    to: '/reports', icon: 'report', lead: true,
    en: ['Community reporting', 'Submit an issue and follow its status'],
    ta: ['சமூக அறிக்கை', 'பிரச்சினையைப் பதிவு செய்து நிலையைப் பாருங்கள்'],
  },
  {
    to: '/skills', icon: 'handHeart', lead: true,
    en: ['Volunteer', 'Offer your skills and time locally'],
    ta: ['தன்னார்வ சேவை', 'உங்கள் திறனையும் நேரத்தையும் வழங்குங்கள்'],
  },
  {
    to: '/events', icon: 'calendar',
    en: ['Local activities', 'Meetings and events near you'],
    ta: ['உள்ளூர் நிகழ்வுகள்', 'உங்கள் பகுதியில் கூட்டங்களும் நிகழ்வுகளும்'],
  },
  {
    to: '/fund', icon: 'heart',
    en: ['Party Fund', 'Contribute to movement operations'],
    ta: ['கட்சி நிதி', 'இயக்கச் செயற்பாடுகளுக்கு பங்களியுங்கள்'],
  },
  {
    to: '/referral', icon: 'users',
    en: ['Invite a member', 'Share your referral and grow the roll'],
    ta: ['உறுப்பினரை அழையுங்கள்', 'உங்கள் பரிந்துரைக் குறியீட்டைப் பகிருங்கள்'],
  },
  {
    to: '/gallery', icon: 'image',
    en: ['Community gallery', 'Photos from across the five districts'],
    ta: ['சமூகப் படங்கள்', 'ஐந்து மாவட்டங்களிலிருந்து படங்கள்'],
  },
];

const EXPLORE: Tile[] = [
  {
    to: '/ideas', icon: 'bulb',
    en: ['Community ideas', 'Share and explore ideas for a better tomorrow'],
    ta: ['சமூகக் கருத்துகள்', 'சிறந்த நாளைக்கான கருத்துகளைப் பகிருங்கள்'],
  },
  {
    to: '/survey', icon: 'clipboard',
    en: ['Surveys', 'Your opinion shapes change'],
    ta: ['கருத்துக்கணிப்புகள்', 'உங்கள் கருத்து மாற்றத்தை உருவாக்கும்'],
  },
  {
    to: '/courses', icon: 'book',
    en: ['Learning', 'Resources and knowledge for our community'],
    ta: ['கற்றல்', 'எங்கள் சமூகத்திற்கான வளங்களும் அறிவும்'],
  },
];

/* A lattice standing in for the GN divisions of the province — abstract on
   purpose. A real-looking map outline that is not actually the member's area
   would be worse than no map at all. Decorative, so hidden from the tree. */
function AreaMotif() {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 4; col++) {
      const emphasised = (r === 1 && col === 1) || (r === 0 && col === 3);
      cells.push(
        <rect
          key={`${r}-${col}`}
          x={col * 42} y={r * 34} width={34} height={26} rx={3}
          fill="none" stroke="#ffffff" strokeWidth={1}
          opacity={emphasised ? 0.9 : 0.45}
        />,
      );
    }
  }
  return (
    <svg className="cm-area-motif" viewBox="0 0 172 94" aria-hidden="true" focusable="false">
      {cells}
    </svg>
  );
}

function DeckTile({ tile, lang }: { tile: Tile; lang: 'en' | 'ta' }) {
  const [title, detail] = tile[lang];
  return (
    <Link to={tile.to} className={`cm-tile${tile.lead ? ' cm-tile--lead' : ''}`}>
      <span className="cm-tile-ic" aria-hidden="true">
        <Icon name={tile.icon} size={tile.lead ? 20 : 19} strokeWidth={tile.lead ? 2 : 1.9} />
      </span>
      <strong>{title}</strong>
      <small>{detail}</small>
      <span className="cm-tile-go cm-chevron" aria-hidden="true">
        <Icon name="chevron" size={14} strokeWidth={2} />
      </span>
    </Link>
  );
}

export function Community() {
  const t = useWorkspaceText();
  const lang: 'en' | 'ta' = t('en', 'ta') as 'en' | 'ta';

  return (
    <main className="workspace">
      <header className="cm-head">
        <div className="cm-head-text">
          {/* Mixed script in one string: without lang on each part a screen
              reader reads the Tamil with an English voice, which is unintelligible. */}
          <span className="work-eyebrow">
            <span lang="en">MY PEOPLE</span> · <span lang="ta">என் மக்கள்</span>
          </span>
          <h1>{t('Community', 'சமூகம்')}</h1>
          <p>{t('Your local connections, opportunities and participation.', 'உங்கள் உள்ளூர் இணைப்புகள், வாய்ப்புகள் மற்றும் பங்கேற்பு.')}</p>
        </div>
        <div className="cm-head-actions">
          {/* The mockup shows a search and a filter control here. Neither feature
              exists yet, and an accessible name that promises one is worse than
              no control at all: a screen-reader user told "Search the community"
              lands on the events list with no search anywhere, and has no way to
              know the button simply does something else.

              So these are named for what they actually do. When real search and
              filtering land, the names change with the behaviour. */}
          <Link className="cm-icon-btn" to="/events" aria-label={t('Browse events and activities', 'நிகழ்வுகளைப் பார்வையிடுங்கள்')}>
            <Icon name="search" size={18} strokeWidth={2} />
          </Link>
          <Link className="cm-icon-btn" to="/area" aria-label={t('Go to my area', 'எனது பகுதிக்குச் செல்லுங்கள்')}>
            <Icon name="sliders" size={18} strokeWidth={2} />
          </Link>
        </div>
      </header>

      {/* The whole card is one link; the circle is decoration, not a second
          tab stop. */}
      <Link to="/area" className="cm-area">
        <AreaMotif />
        <span className="cm-area-text">
          <span className="cm-area-label">{t('MY AREA', 'எனது பகுதி')}</span>
          <h2>{t('Your district, DS and GN connection', 'உங்கள் மாவட்டம், பிரதேசம், கிராம சேவகர் பிரிவு')}</h2>
          <p>{t('Access local information, representatives and key updates.', 'உள்ளூர் தகவல்கள், பிரதிநிதிகள் மற்றும் முக்கிய புதுப்பிப்புகள்.')}</p>
        </span>
        <span className="cm-area-go" aria-hidden="true">
          <Icon name="chevron" size={20} strokeWidth={2.2} />
        </span>
      </Link>

      {/* Named for the heading outline; the grid itself needs no visible title. */}
      <h2 className="sr-only">{t('Ways to take part', 'பங்கேற்க வழிகள்')}</h2>
      <div className="cm-deck">
        {TILES.map((tile) => <DeckTile key={tile.to} tile={tile} lang={lang} />)}
      </div>

      <section className="cm-band" aria-labelledby="cm-explore-h">
        <div className="cm-band-head">
          <span className="cm-band-rule" aria-hidden="true" />
          <h2 id="cm-explore-h">{t('Explore & Learn', 'ஆராய்ந்து கற்றிடுங்கள்')}</h2>
        </div>
        <span className="cm-band-pill">{t('Learn. Share. Take part.', 'கற்றல். பகிர்தல். பங்கேற்பு.')}</span>
        <p>{t('Ideas, surveys and learning for a stronger community.', 'வலுவான சமூகத்திற்கான கருத்துகள், கணிப்புகள் மற்றும் கற்றல்.')}</p>
        {/* The screen this replaced carried a disclaimer, and it is still true:
            getIdeas / getSurvey / getCourses are not in httpContent.ts, so all
            three are served by the mock client. Promotional copy on demonstration
            data is the kind of small dishonesty a civic app cannot afford.
            Delete this line when the three are backed by real data. */}
        <p className="cm-band-note">{t('These three currently show demonstration content.', 'இம்மூன்றும் தற்போது மாதிரித் தரவுகளைக் காட்டுகின்றன.')}</p>
        <div className="cm-band-list">
          {EXPLORE.map((tile) => {
            const [title, detail] = tile[lang];
            return (
              <Link key={tile.to} to={tile.to} className="cm-band-card">
                <span className="cm-tile-ic" aria-hidden="true">
                  <Icon name={tile.icon} size={19} strokeWidth={1.9} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                <span className="cm-chevron" aria-hidden="true">
                  <Icon name="chevron" size={14} strokeWidth={2} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
