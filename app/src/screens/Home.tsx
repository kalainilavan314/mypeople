import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, grad, radius, shadow } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { QueryBoundary } from '../components/ui';
import { Bleed, ChipRow, ImpactStrip, NetImage, QuickTile, SectionHead, StatusBadge, type BadgeVariant } from '../components/nn';
import { useAnnouncements, useEvents, useMember, useSurvey, useVoteSurvey } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { votedOption } from '../data/mock/client';
import type { NpmEvent } from '../data/types';

/* ---------------------------------------------------------------- reference imagery
   Photography from the NorthNadu design reference. Every one degrades to a
   themed gradient placeholder via <NetImage> if it fails or the device is offline. */
const IMG = {
  me: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg',
  // Hero banner — Northern Province coastline (NorthUnity reference).
  hero: {
    src: 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg',
    alt: 'Aerial view of Northern Sri Lanka coastline with palmyrah trees and lagoon waters',
  },
  // Cover art for the featured card + "Near you" rail, indexed by event order.
  covers: [
    { src: 'https://images.unsplash.com/photo-1613899323447-87ac2ee746b8', alt: 'Volunteers gathered for a community cleanup in Jaffna' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1c57ce6e8-1786524733616.png', alt: 'Tamil farmer in a paddy field in the Northern Province' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e394c2f2-1786524735001.png', alt: 'Young Tamil students at a leadership conference' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1436754dd-1786524734456.png', alt: 'Volunteers cleaning a coastal beach in Mannar' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_16cd4df73-1786524735503.png', alt: 'Youth learning digital skills in Vavuniya library' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_19d6d5413-1786524734227.png', alt: 'Artisans demonstrating palmyrah weaving in Nallur' },
  ],
  organizer: 'https://images.unsplash.com/photo-1653855394894-4c941ebd3748',
  gallery: [
    { title: 'Jaffna Cultural Festival', place: 'Nallur, Jaffna', src: 'https://img.rocket.new/generatedImages/rocket_gen_img_19d6d5413-1786524734227.png', alt: 'Tamil classical dancers at the Jaffna cultural festival' },
    { title: 'Community Workshop', place: 'Kilinochchi', src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e394c2f2-1786524735001.png', alt: 'Community members at a workshop in Kilinochchi' },
    { title: 'Paddy Harvest Season', place: 'Mullaitivu', src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1c57ce6e8-1786524733616.png', alt: 'Green paddy fields during harvest season in Mullaitivu' },
  ],
} as const;

const CHIPS = ['Popular', 'Volunteer', 'Survey', 'Events', 'Culture'];

/** Category → badge colour, matching the reference's badge variants. */
function badgeFor(cat?: string | null): { label: string; variant: BadgeVariant } {
  switch ((cat ?? '').toLowerCase()) {
    case 'volunteering': return { label: 'Open', variant: 'active' };
    case 'convention': return { label: 'Featured', variant: 'warning' };
    case 'education': return { label: 'New', variant: 'info' };
    case 'environment': return { label: 'Open', variant: 'active' };
    default: return { label: 'Open', variant: 'active' };
  }
}

const fmtLong = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function greetingTa(): string {
  const h = new Date().getHours();
  if (h < 12) return 'காலை வணக்கம்';
  if (h < 17) return 'வணக்கம்';
  return 'மாலை வணக்கம்';
}

export function Home() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const memberQ = useMember();
  const annQ = useAnnouncements();
  const eventsQ = useEvents();
  const surveyQ = useSurvey();
  const vote = useVoteSurvey();
  const me = useMe();
  const [chip, setChip] = useState(0);

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%', paddingBottom: 8 }}>
      {/* ============================ Header (light surface) ============================ */}
      <QueryBoundary query={memberQ}>
        {(member) => {
          const district = member.electorateNameEn ?? 'Northern Province';
          return (
            <div style={{ background: c.card, padding: '12px 16px 16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => navigate('/profile')}
                aria-label={t('nav.profile')}
                style={{ flex: 'none', width: 44, height: 44, borderRadius: 999, padding: 0, border: `2px solid ${c.maroonTintBorder}`, background: 'none', cursor: 'pointer', overflow: 'hidden' }}
              >
                <NetImage src={me?.avatarUrl ?? IMG.me} alt={`Profile photo of ${member.fullName}`} width={40} height={40} radius={999} fallbackIcon="user" />
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `600 11px/1 ${font.ta}`, color: c.ink2, letterSpacing: '.3px' }}>{greetingTa()}</div>
                <div style={{ font: `700 15px/1.25 ${font.head}`, color: c.ink, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Vanakkam, {member.fullName.split(' ')[0]}! 🙏
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                  <Icon name="mapPin" size={12} color={c.primary} strokeWidth={2.2} />
                  <span style={{ font: `600 11px/1 ${font.ui}`, color: c.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {district} • Northern Province
                  </span>
                </div>
              </div>

              <HeaderIcon icon="search" label={t('common.search', 'Search')} onClick={() => navigate('/events')} />
              <HeaderIcon icon="bell" label={t('profile.notifications')} onClick={() => navigate('/notifications')} dot />
            </div>
          );
        }}
      </QueryBoundary>

      {/* ============================ Hero banner (NorthUnity) ============================ */}
      <div style={{ padding: '16px 16px 0' }}>
        <HeroCard onCta={() => navigate('/skills')} />
      </div>

      {/* ============================ Category chips ============================ */}
      <div style={{ paddingTop: 16 }}>
        <ChipRow items={CHIPS} selected={chip} onSelect={setChip} />
      </div>

      {/* ============================ Featured activity ============================ */}
      <div style={{ padding: '16px 16px 0' }}>
        <QueryBoundary query={eventsQ} label={t('common.loading')}>
          {(events) => {
            const list = events.length ? events : [];
            if (!list.length) return null;
            const ev = list[chip % list.length];
            return <FeaturedCard ev={ev} lang={lang} idx={chip % list.length} onOpen={() => navigate(`/events/${ev.id}`)} />;
          }}
        </QueryBoundary>
      </div>

      {/* ============================ Quick actions ============================ */}
      <div style={{ paddingTop: 16 }}>
        <SectionHead title={t('home.whatToDo')} />
      </div>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <QuickTile icon="handHeart" gradient={grad.volunteer} label={t('home.tileVolunteer')} sublabel={t('home.tileVolunteerSub')} onClick={() => navigate('/skills')} />
        <QuickTile icon="forum" gradient={grad.survey} label={t('home.tileSurveys')} sublabel={t('home.tileSurveysSub')} onClick={() => navigate('/survey')} />
        {/* Wide "Report Issue" card (NorthUnity reference) — the reporting entry point */}
        <button
          onClick={() => navigate('/reports')}
          className="press"
          style={{
            gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14, height: 76,
            padding: '0 18px', border: 'none', borderRadius: radius.lg, cursor: 'pointer',
            background: grad.community, boxShadow: shadow.tile, textAlign: 'left',
          }}
        >
          <Icon name="report" size={26} color="#fff" strokeWidth={1.9} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', font: `700 15px/1.2 ${font.head}`, color: '#fff' }}>{t('home.tileReport')}</span>
            <span style={{ display: 'block', font: `400 12px/1.3 ${font.ui}`, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>{t('home.tileReportSub')}</span>
          </span>
          <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron" size={16} color="#fff" strokeWidth={2.4} />
          </span>
        </button>
        <QuickTile icon="calendar" gradient={grad.events} label={t('home.tileEvents')} sublabel={t('home.tileEventsSub')} onClick={() => navigate('/events')} />
        <QuickTile icon="users" gradient={grad.community} label={t('home.tileCommunity')} sublabel={t('home.tileCommunitySub')} onClick={() => navigate('/ideas')} />
        {/* Wide "Party Fund" card — donations entry point */}
        <button
          onClick={() => navigate('/fund')}
          className="press"
          style={{
            gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14, height: 76,
            padding: '0 18px', border: 'none', borderRadius: radius.lg, cursor: 'pointer',
            background: grad.primary, boxShadow: shadow.tile, textAlign: 'left',
          }}
        >
          <Icon name="heart" size={26} color="#fff" strokeWidth={1.9} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', font: `700 15px/1.2 ${font.head}`, color: '#fff' }}>{t('home.tileFund')}</span>
            <span style={{ display: 'block', font: `400 12px/1.3 ${font.ui}`, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>{t('home.tileFundSub')}</span>
          </span>
          <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron" size={16} color="#fff" strokeWidth={2.4} />
          </span>
        </button>
      </div>

      {/* ============================ Near you ============================ */}
      <QueryBoundary query={eventsQ}>
        {(events) =>
          events.length ? (
            <div style={{ paddingTop: 28 }}>
              <QueryBoundary query={memberQ}>
                {(m) => <SectionHead title={`Near You in ${m.electorateNameEn ?? 'the North'}`} action={t('common.all')} onAction={() => navigate('/events')} />}
              </QueryBoundary>
              <Bleed>
                {events.map((ev, i) => (
                  <NearbyCard key={ev.id} ev={ev} lang={lang} idx={i} onOpen={() => navigate(`/events/${ev.id}`)} />
                ))}
              </Bleed>
            </div>
          ) : null
        }
      </QueryBoundary>

      {/* ============================ Latest announcements ============================ */}
      <QueryBoundary query={annQ}>
        {(anns) => (
          <div style={{ paddingTop: 28 }}>
            <SectionHead title={t('home.announcements')} action={t('common.all')} onAction={() => navigate('/notifications')} />
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {anns.slice(0, 4).map((a, i) => {
                const tone = [c.primary, c.tertiary, c.purple, c.success][i % 4];
                const toneBg = [c.maroonTint, c.tertiaryContainer, 'rgba(106,27,154,.12)', c.successBg][i % 4];
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/announcement/${a.id}`)}
                    className="press"
                    style={{
                      textAlign: 'left', cursor: 'pointer', background: c.card, borderRadius: radius.xl, padding: '14px 16px',
                      border: `1px solid ${a.pinned ? c.maroonTintBorder : c.hairline}`, boxShadow: shadow.card,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {a.pinned && <span style={{ width: 8, height: 8, borderRadius: 999, background: tone, flex: 'none' }} />}
                      <span style={{ font: `700 11px/1 ${font.ui}`, color: tone, background: toneBg, padding: '5px 9px', borderRadius: radius.pill }}>
                        {a.pinned ? t('home.pinned') : t('home.update')}
                      </span>
                      <span style={{ font: `500 12px/1 ${font.ui}`, color: c.ink2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.authorName}</span>
                      <span style={{ font: `400 12px/1 ${font.ui}`, color: c.ink3, flex: 'none' }}>{fmtShort(a.publishedAt)}</span>
                    </div>
                    <div style={{ font: `600 15px/1.4 ${font.ta}`, color: c.ink }}>{pick(lang, a.titleTa, a.titleEn)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </QueryBoundary>

      {/* ============================ Community gallery ============================ */}
      <div style={{ paddingTop: 28 }}>
        <SectionHead title={t('nav.gallery')} action={t('common.all')} onAction={() => navigate('/gallery')} />
        <Bleed>
          {IMG.gallery.map((g) => (
            <button key={g.title} onClick={() => navigate('/gallery')} className="press" style={{ flex: 'none', width: 190, height: 210, padding: 0, border: 'none', borderRadius: radius.xl, overflow: 'hidden', position: 'relative', cursor: 'pointer', boxShadow: shadow.card }}>
              <NetImage src={g.src} alt={g.alt} width={190} height={210} fallbackIcon="camera" />
              <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.12) 55%, transparent 100%)' }} />
              <span style={{ position: 'absolute', left: 12, right: 12, bottom: 12, textAlign: 'left' }}>
                <span style={{ display: 'block', font: `700 14px/1.25 ${font.head}`, color: '#fff' }}>{g.title}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Icon name="mapPin" size={11} color="rgba(255,255,255,.85)" strokeWidth={2.2} />
                  <span style={{ font: `400 11px/1 ${font.ui}`, color: 'rgba(255,255,255,.85)' }}>{g.place}</span>
                </span>
              </span>
            </button>
          ))}
        </Bleed>
      </div>

      {/* ============================ Inline survey ============================ */}
      <QueryBoundary query={surveyQ}>
        {(survey) => {
          const q = survey.questions[0];
          const chosen = votedOption(q.id);
          const total = q.options.reduce((n, o) => n + o.votes, 0);
          return (
            <div style={{ padding: '28px 16px 0' }}>
              <div style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: '20px 18px', boxShadow: shadow.card }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ font: `700 10px/1 ${font.ui}`, letterSpacing: '.14em', textTransform: 'uppercase', color: c.tertiary, background: c.tertiaryContainer, padding: '5px 8px', borderRadius: 6 }}>{t('survey.title')}</span>
                  <span style={{ font: `400 12px/1 ${font.ui}`, color: c.ink3 }}>{t('home.closesIn', { count: 2 })}</span>
                </div>
                <div style={{ font: `600 16px/1.45 ${font.ta}`, color: c.ink }}>{pick(lang, q.promptTa, q.promptEn)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
                  {q.options.map((o) => {
                    const pct = chosen ? Math.round((o.votes / total) * 100) : 0;
                    const picked = chosen === o.id;
                    return (
                      <button
                        key={o.id}
                        disabled={!!chosen}
                        onClick={() => !chosen && vote.mutate({ questionId: q.id, optionId: o.id })}
                        style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', background: c.cardCream, border: `1.5px solid ${picked ? c.primary : c.hairline}`, borderRadius: radius.md, minHeight: 52, display: 'flex', alignItems: 'center', gap: 11, padding: '0 14px', cursor: chosen ? 'default' : 'pointer' }}
                      >
                        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: c.maroonTint, width: `${pct}%`, transition: 'width 480ms var(--ease)' }} />
                        <span style={{ position: 'relative', font: `600 14px/1.3 ${font.ta}`, color: c.ink0, flex: 1 }}>{pick(lang, o.labelTa, o.labelEn)}</span>
                        {chosen && <span style={{ position: 'relative', font: `700 13px/1 ${font.ui}`, color: c.primary }}>{pct}%</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ font: `400 12px/1 ${font.ui}`, color: c.ink3, marginTop: 12 }}>
                  {t('survey.membersVoted', { n: (survey.totalResponses + (chosen ? 1 : 0)).toLocaleString() })} · {t('survey.forVoting', { points: survey.points })}
                </div>
              </div>
            </div>
          );
        }}
      </QueryBoundary>

      {/* ============================ Community impact ============================ */}
      <div style={{ padding: '28px 16px 8px' }}>
        <QueryBoundary query={eventsQ}>
          {(events) => (
            <ImpactStrip
              title={t('home.impactTitle')}
              stats={[
                { value: '2,847', label: t('home.impactMembers'), sublabel: t('home.impactMembersSub') },
                { value: String(events.length), label: t('home.impactActivities'), sublabel: t('home.impactActivitiesSub') },
                { value: '89', label: t('home.impactResolved'), sublabel: t('home.impactResolvedSub') },
              ]}
            />
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ HeroCard
   NorthUnity hero banner: coastline photo, dark scrim from the bottom-left,
   gold "Community" badge, two-line promise, Get Involved CTA + caption, and
   a frosted expand chip top-right. */
function HeroCard({ onCta }: { onCta: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ position: 'relative', height: 180, borderRadius: radius.xl, overflow: 'hidden', boxShadow: '0 8px 20px rgba(232,168,56,.22)' }}>
      <NetImage src={IMG.hero.src} alt={IMG.hero.alt} width="100%" height={180} fallbackIcon="image" />
      <span
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top right, rgba(28,25,23,.75) 0%, rgba(28,25,23,.3) 50%, transparent 100%)' }}
      />

      <span
        aria-hidden="true"
        style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="chevron" size={15} color="#fff" strokeWidth={2.2} style={{ transform: 'rotate(-45deg)' }} />
      </span>

      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 18 }}>
        <span style={{ display: 'inline-block', font: `700 11px/1 ${font.ui}`, letterSpacing: '.5px', color: '#fff', background: 'rgba(232,168,56,.9)', padding: '5px 10px', borderRadius: 6 }}>
          {t('home.heroBadge')}
        </span>
        <div style={{ font: `800 22px/1.2 ${font.head}`, color: '#fff', letterSpacing: '-0.3px', marginTop: 8 }}>
          {t('home.heroTitle1')}
          <br />
          {t('home.heroTitle2')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button
            onClick={onCta}
            className="press"
            style={{ flex: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px', borderRadius: 10, background: '#043074', color: '#fff', font: `700 13px/1 ${font.head}` }}
          >
            {t('home.heroCta')}
          </button>
          <span style={{ font: `400 11px/1.3 ${font.ui}`, color: 'rgba(255,255,255,.7)' }}>{t('home.heroSub')}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ HeaderIcon */
function HeaderIcon({ icon, label, onClick, dot = false }: { icon: IconName; label: string; onClick: () => void; dot?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{ position: 'relative', flex: 'none', width: 38, height: 38, borderRadius: 999, background: c.surfaceVariant, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    >
      <Icon name={icon} size={19} color={c.ink} strokeWidth={1.9} />
      {dot && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: c.error, border: `1.5px solid ${c.card}` }} />}
    </button>
  );
}

/* ---------------------------------------------------------------- FeaturedCard
   Full-bleed image, gradient scrim, badge top-left, headcount top-right,
   info + organizer bottom-left, gradient "Join" pill bottom-right. */
function FeaturedCard({ ev, lang, idx, onOpen }: { ev: NpmEvent; lang: string; idx: number; onOpen: () => void }) {
  const cover = IMG.covers[idx % IMG.covers.length];
  const badge = useMemo(() => badgeFor(ev.category), [ev.category]);
  return (
    <div style={{ position: 'relative', height: 300, borderRadius: radius.xxl, overflow: 'hidden', boxShadow: shadow.lg }}>
      <NetImage src={cover.src} alt={cover.alt} width="100%" height={300} fallbackIcon="calendar" />
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.93) 0%, rgba(0,0,0,.53) 35%, transparent 70%)' }} />

      <span style={{ position: 'absolute', top: 16, left: 16 }}>
        <StatusBadge label={badge.label} variant={badge.variant} showDot />
      </span>

      <span style={{ position: 'absolute', top: 16, right: 16, display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: radius.pill, background: 'rgba(0,0,0,.5)' }}>
        <Icon name="users" size={13} color="#fff" strokeWidth={2} />
        <span style={{ font: `600 11px/1 ${font.ui}`, color: '#fff' }}>
          {ev.rsvpCount} {ev.rsvpCount === 1 ? 'volunteer' : 'volunteers'}
        </span>
      </span>

      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `700 17px/1.3 ${font.ta}`, color: '#fff' }}>{pick(lang, ev.titleTa, ev.titleEn)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            <Icon name="mapPin" size={12} color="rgba(255,255,255,.8)" strokeWidth={2.2} />
            <span style={{ font: `400 12px/1 ${font.ui}`, color: 'rgba(255,255,255,.8)' }}>{ev.venue}</span>
            <Icon name="calendar" size={12} color="rgba(255,255,255,.8)" strokeWidth={2.2} style={{ marginLeft: 6 }} />
            <span style={{ font: `400 12px/1 ${font.ui}`, color: 'rgba(255,255,255,.8)' }}>{fmtLong(ev.startsAt)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <NetImage src={IMG.organizer} alt="Event organiser" width={22} height={22} radius={999} fallbackIcon="user" />
            <span style={{ font: `600 12px/1 ${font.ui}`, color: 'rgba(255,255,255,.85)' }}>{ev.category ?? 'Community'}</span>
          </div>
        </div>
        <button
          onClick={onOpen}
          className="press"
          style={{ flex: 'none', border: 'none', cursor: 'pointer', height: 38, padding: '0 20px', borderRadius: radius.pill, background: grad.join, font: `700 14px/1 ${font.head}`, color: '#fff' }}
        >
          {ev.myStatus === 'going' ? '✓ Joined' : 'Join'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ NearbyCard */
function NearbyCard({ ev, lang, idx, onOpen }: { ev: NpmEvent; lang: string; idx: number; onOpen: () => void }) {
  const cover = IMG.covers[(idx + 3) % IMG.covers.length];
  const badge = badgeFor(ev.category);
  const spots = Math.max(0, 40 - ev.rsvpCount);
  return (
    <button onClick={onOpen} className="press" style={{ flex: 'none', width: 178, padding: 0, border: 'none', background: c.card, borderRadius: radius.xl, overflow: 'hidden', boxShadow: shadow.card, cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ position: 'relative' }}>
        <NetImage src={cover.src} alt={cover.alt} width={178} height={110} fallbackIcon="calendar" />
        <span style={{ position: 'absolute', top: 8, left: 8 }}>
          <StatusBadge label={badge.label} variant={badge.variant} />
        </span>
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ font: `700 13px/1.3 ${font.ta}`, color: c.ink, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 34 }}>
          {pick(lang, ev.titleTa, ev.titleEn)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6 }}>
          <Icon name="calendar" size={11} color={c.primary} strokeWidth={2.2} />
          <span style={{ font: `700 11px/1 ${font.ui}`, color: c.primary }}>{fmtShort(ev.startsAt)}</span>
          <span style={{ font: `400 11px/1 ${font.ui}`, color: c.ink3, marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spots} spots left</span>
        </div>
      </div>
    </button>
  );
}
