import { Link } from 'react-router-dom';
import { c, font, radius, type as ty } from '../theme/tokens';
import { useMeQuery } from '../hooks/useMe';
import { useEvents } from '../data/queries';
import { QueryBoundary } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { displayMemberName } from '../lib/memberDisplay';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { HomeTopBar } from '../components/HomeTopBar';

/* ================================================================= Home — H01
   The next-action desk (spec §3 / wireframe H01–H02):
   - Header: time-of-day greeting + assigned GN division + notifications bell
   - "Your next step" priority card (navy accent) — or, while identity review is
     pending, the H02 "Verification in progress" amber state with locked actions
   - 2×2 quick action grid: Report · Volunteer · My area · Community
   - "Coming up nearby" — the next relevant event with a date chip
   - Mission tagline footer
   No giant cover image and no competing dashboards (spec guardrail); the member
   credential and QR live on the Card tab (C01), not here.
============================================================================= */

type Action = { to: string; icon: IconName; en: string; ta: string; subEn: string; subTa: string };
const ACTIONS: Action[] = [
  { to: '/reports', icon: 'report', en: 'Report issue', ta: 'பிரச்சினை பதிவு', subEn: 'Local concerns', subTa: 'உள்ளூர் பிரச்சினைகள்' },
  { to: '/skills', icon: 'handHeart', en: 'Volunteer', ta: 'தன்னார்வம்', subEn: 'Share skills', subTa: 'திறன்களைப் பகிர்' },
  { to: '/area', icon: 'mapPin', en: 'My area', ta: 'எனது பகுதி', subEn: 'GN updates', subTa: 'பகுதி புதுப்பிப்புகள்' },
  { to: '/community', icon: 'users', en: 'Community', ta: 'சமூகம்', subEn: 'Hub & services', subTa: 'சேவைகள்' },
];

function greeting(t: (en: string, ta: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t('Good morning', 'காலை வணக்கம்');
  if (h < 17) return t('Good afternoon', 'மதிய வணக்கம்');
  return t('Good evening', 'மாலை வணக்கம்');
}

export function Home() {
  const meQ = useMeQuery();
  const me = meQ.data ?? null;
  const events = useEvents();
  const t = useWorkspaceText();

  const name = displayMemberName(me) ?? localStorage.getItem('npm.name')?.trim() ?? 'Member';
  const firstName = name.split(' ')[0];
  const location =
    [me?.districtName, me?.gsName].filter(Boolean).join(' / ') ||
    t('Your GN division', 'உங்கள் கிராம சேவகர் பிரிவு');
  const awaitingReview = me?.verificationStatus === 'review_pending';

  const upcoming = (events.data ?? [])
    .filter((e) => Date.parse(e.startsAt) >= Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const nextEvent = upcoming[0];

  const label = (en: string, ta: string, extra?: React.CSSProperties) => (
    <span className={t('en', 'ta') === 'ta' ? 'ta' : undefined} style={extra}>{t(en, ta)}</span>
  );

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return {
      month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Asia/Colombo' }).toUpperCase(),
      day: d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Colombo' }),
      time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' }),
      rel: d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Asia/Colombo' }),
    };
  };

  return (
    <>
      <HomeTopBar />
      <main className="workspace" style={{ paddingTop: 'calc(72px + var(--safe-top, 0px))' }}>
      {/* ---------- Greeting + assigned GN division ---------- */}
      <header>
        <h1 style={{ font: `700 ${ty.section.size}px/1.2 ${font.head}`, letterSpacing: '-0.005em', color: c.ink0, margin: 0 }}>
          {greeting(t)}, {firstName}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icon name="mapPin" size={14} color={c.accent} strokeWidth={2.2} style={{ flex: 'none' }} />
          <span style={{ font: `500 ${ty.secondary.size}px/1.3 ${font.ui}`, color: c.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {location}
          </span>
        </div>
      </header>

      {/* ---------- Your next step / Verification in progress ---------- */}
      {awaitingReview ? (
        <section
          aria-label={t('Verification in progress', 'சரிபார்ப்பு நடைபெறுகிறது')}
          style={{
            marginTop: 20, borderRadius: radius.lg, overflow: 'hidden',
            background: c.warningBg, border: `1px solid ${c.warning}`,
          }}
        >
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="info" size={16} color={c.warning} strokeWidth={2.6} />
              {label('VERIFICATION IN PROGRESS', 'சரிபார்ப்பு நடைபெறுகிறது', { font: `700 11px/1 ${font.ui}`, letterSpacing: '0.04em', color: c.warning })}
            </div>
            {label('Documents received. The team will notify you after review.', 'ஆவணங்கள் பெறப்பட்டன. மதிப்பாய்வுக்குப் பின் அறிவிப்போம்.', { font: `500 ${ty.body.size}px/1.5 ${font.ui}`, color: c.ink2 })}
            <Link
              to="/profile"
              style={{ marginTop: 6, alignSelf: 'flex-start', font: `600 ${ty.label.size}px/1 ${font.ui}`, color: c.accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              {t('View verification', 'சரிபார்ப்பைப் பார்')} <Icon name="arrowRight" size={14} strokeWidth={2.4} />
            </Link>
          </div>
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${c.warning}`, background: 'rgba(217,119,6,0.06)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="lock" size={15} color={c.warning} strokeWidth={2.2} style={{ marginTop: 1, flexShrink: 0 }} />
            {label('Your active card and restricted actions appear after approval.', 'உங்கள் அட்டை மற்றும் கட்டுப்படுத்தப்பட்ட செயல்கள் ஒப்புதலுக்குப் பின் தோன்றும்.', { font: `500 ${ty.secondary.size}px/1.45 ${font.ui}`, color: c.ink2 })}
          </div>
        </section>
      ) : (
        <section
          aria-label={t('Your next step', 'உங்கள் அடுத்த படி')}
          style={{
            marginTop: 20, position: 'relative', borderRadius: radius.lg,
            background: c.card, border: `1px solid ${c.hairline}`, boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          }}
        >
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: c.primary }} />
          <div style={{ padding: '16px 16px 16px 20px' }}>
            {label('YOUR NEXT STEP', 'உங்கள் அடுத்த படி', { font: `700 11px/1 ${font.ui}`, letterSpacing: '0.05em', color: c.accent })}
            {nextEvent ? (
              <>
                <h2 style={{ font: `700 ${ty.section.size}px/1.25 ${font.head}`, color: c.ink0, margin: '8px 0 4px' }}>
                  {t(nextEvent.titleEn, nextEvent.titleTa) || nextEvent.titleEn || nextEvent.titleTa}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: `500 ${ty.secondary.size}px/1.4 ${font.ui}`, color: c.ink2 }}>
                  <Icon name="mapPin" size={14} color={c.ink3} strokeWidth={2} />
                  <span>{nextEvent.venue || t('Meeting point in details', 'விவரங்களில் சந்திப்பு இடம்')}</span>
                </div>
                <Link
                  to={'/events/' + nextEvent.id}
                  style={{
                    marginTop: 14, height: 44, borderRadius: radius.sm, background: c.primary, color: c.onPrimary,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 20px',
                    font: `700 ${ty.card.size}px/1 ${font.ui}`,
                  }}
                >
                  {t('View event', 'நிகழ்வைப் பார்')} <Icon name="arrowRight" size={16} color={c.onPrimary} strokeWidth={2.4} />
                </Link>
              </>
            ) : (
              <>
                <h2 style={{ font: `700 ${ty.section.size}px/1.25 ${font.head}`, color: c.ink0, margin: '8px 0 4px' }}>
                  {t('Complete your profile', 'உங்கள் சுயவிவரத்தை நிறைவு செய்யுங்கள்')}
                </h2>
                {label('Add your details so your community can reach you.', 'உங்கள் சமூகம் உங்களைத் தொடர்பு கொள்ள விவரங்களைச் சேர்க்கவும்.', { font: `500 ${ty.secondary.size}px/1.4 ${font.ui}`, color: c.ink2 })}
                <Link
                  to="/profile"
                  style={{
                    marginTop: 14, height: 44, borderRadius: radius.sm, background: c.primary, color: c.onPrimary,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 20px',
                    font: `700 ${ty.card.size}px/1 ${font.ui}`,
                  }}
                >
                  {t('Go to profile', 'சுயவிவரத்திற்கு')} <Icon name="arrowRight" size={16} color={c.onPrimary} strokeWidth={2.4} />
                </Link>
              </>
            )}
          </div>
        </section>
      )}

      {/* ---------- 2×2 quick action grid ---------- */}
      <section style={{ marginTop: 24 }} aria-label={t('Actions', 'செயல்கள்')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              style={{
                display: 'flex', flexDirection: 'column', gap: 8, padding: 14, minHeight: 92,
                borderRadius: radius.lg, background: c.card, border: `1px solid ${c.hairline}`, boxShadow: 'var(--shadow-card)',
              }}
            >
              <span style={{ width: 40, height: 40, borderRadius: radius.md, display: 'grid', placeItems: 'center', color: c.primary, background: 'var(--soft-blue)' }}>
                <Icon name={a.icon} size={20} color={c.primary} strokeWidth={2.2} />
              </span>
              <div>
                <div className={t('en', 'ta') === 'ta' ? 'ta' : undefined} style={{ font: `600 ${ty.card.size}px/1.2 ${font.ui}`, color: c.ink0 }}>{t(a.en, a.ta)}</div>
                <div className={t('en', 'ta') === 'ta' ? 'ta' : undefined} style={{ font: `400 ${ty.secondary.size}px/1.3 ${font.ui}`, color: c.ink3, marginTop: 2 }}>{t(a.subEn, a.subTa)}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Coming up nearby ---------- */}
      <section style={{ marginTop: 28 }} aria-label={t('Coming up nearby', 'அருகில் வரவிருப்பவை')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ font: `700 ${ty.section.size}px/1.2 ${font.head}`, color: c.ink0, margin: 0 }}>
            {t('Coming up nearby', 'அருகில் வரவிருப்பவை')}
          </h2>
          <Link to="/events" style={{ font: `600 ${ty.label.size}px/1 ${font.ui}`, color: c.accent, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {t('See all', 'அனைத்தும்')} <Icon name="chevron" size={14} strokeWidth={2.4} />
          </Link>
        </div>
        <QueryBoundary query={events}>
          {() => {
            if (!nextEvent) {
              return (
                <div style={{ borderRadius: radius.lg, border: `1px solid ${c.hairline}`, background: c.card, padding: '28px 16px', textAlign: 'center' }}>
                  <Icon name="calendar" size={28} color={c.ink3} strokeWidth={1.8} />
                  <div style={{ font: `600 ${ty.card.size}px/1.3 ${font.ui}`, color: c.ink2, margin: '10px 0 12px' }}>
                    {t('No events nearby this week', 'இந்த வாரம் அருகில் நிகழ்வுகள் இல்லை')}
                  </div>
                  <Link to="/events" style={{ font: `600 ${ty.label.size}px/1 ${font.ui}`, color: c.accent }}>
                    {t('Browse all events', 'அனைத்து நிகழ்வுகளையும் பார்')}
                  </Link>
                </div>
              );
            }
            const d = fmtDate(nextEvent.startsAt);
            return (
              <Link
                to={'/events/' + nextEvent.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: 14,
                  borderRadius: radius.lg, background: c.card, border: `1px solid ${c.hairline}`, boxShadow: 'var(--shadow-card)',
                }}
              >
                <div style={{ flex: 'none', width: 52, borderRadius: radius.md, background: c.primary, color: c.onPrimary, textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ font: `700 11px/1 ${font.ui}`, letterSpacing: '0.04em', opacity: 0.85 }}>{d.month}</div>
                  <div style={{ font: `700 22px/1.1 ${font.ui}`, marginTop: 2 }}>{d.day}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `600 ${ty.card.size}px/1.25 ${font.ui}`, color: c.ink0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t(nextEvent.titleEn, nextEvent.titleTa) || nextEvent.titleEn || nextEvent.titleTa}
                  </div>
                  <div style={{ font: `400 ${ty.secondary.size}px/1.4 ${font.ui}`, color: c.ink3, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.rel}, {d.time} · {nextEvent.venue || t('Venue in details', 'இடம் விவரங்களில்')}
                  </div>
                </div>
                <span style={{ flex: 'none', font: `600 ${ty.caption.size}px/1 ${font.ui}`, color: c.accent, background: 'var(--soft-blue)', borderRadius: radius.pill, padding: '6px 12px' }}>
                  {t('Open', 'திற')}
                </span>
              </Link>
            );
          }}
        </QueryBoundary>
      </section>

      {/* ---------- Mission footer ---------- */}
      <footer style={{ marginTop: 28, paddingBottom: 8, textAlign: 'center' }}>
        <div className={t('en', 'ta') === 'ta' ? 'ta' : undefined} style={{ font: `500 ${ty.secondary.size}px/1.5 ${font.ui}`, color: c.ink3 }}>
          {t('Mission: local needs, shared action, visible progress.', 'நோக்கம்: உள்ளூர் தேவைகள், கூட்டு செயல், தெரியும் முன்னேற்றம்.')}
        </div>
        <div style={{ font: `600 ${ty.caption.size}px/1.4 ${font.ui}`, color: c.ink4, marginTop: 4 }}>
          {t('Northern Province Civic Network', 'வட மாகாண சமூக வலையமைப்பு')}
        </div>
      </footer>
      </main>
    </>
  );
}
