import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { QueryBoundary } from '../components/ui';
import { useEvents, useSetRsvp } from '../data/queries';
import { currentRsvp } from '../data/mock/client';
import type { NpmEvent } from '../data/types';

const eventPin = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#14263D;transform:rotate(-45deg);border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(4,48,116,.5)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
});

/* Category → accessible badge + thumbnail colour. Each badge carries an icon AND
   text, so meaning never rests on colour alone (WCAG 1.4.1). */
type Cat = { label: string; fg: string; bg: string; grad: string; icon: IconName };
const CATS: Record<string, Cat> = {
  volunteer: { label: 'Volunteer', fg: '#16835D', bg: '#E7F3EC', grad: 'linear-gradient(135deg,#1f9e6e,#0f5c40)', icon: 'handHeart' },
  community: { label: 'Community', fg: '#315B82', bg: '#EAF1F9', grad: 'linear-gradient(135deg,#3f6da0,#1c3a5e)', icon: 'users' },
  learning: { label: 'Learning', fg: '#6D4AC4', bg: '#EFEAFA', grad: 'linear-gradient(135deg,#7d5cd0,#4a2f93)', icon: 'book' },
  environment: { label: 'Environment', fg: '#16835D', bg: '#E7F3EC', grad: 'linear-gradient(135deg,#3aa06a,#14633f)', icon: 'sprout' },
  health: { label: 'Health', fg: '#C43D4B', bg: '#FBEAEC', grad: 'linear-gradient(135deg,#d9545f,#9c2531)', icon: 'heart' },
};
function catOf(cat?: string | null): Cat {
  return (cat && CATS[cat.toLowerCase()]) || { label: 'Event', fg: '#315B82', bg: '#EAF1F9', grad: 'linear-gradient(135deg,#2f507a,#14263D)', icon: 'calendar' };
}

/* Locally-saved (bookmarked) events — per device, no backend needed. */
const SAVED_KEY = 'npm.savedEvents';
function readSaved(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as string[]); } catch { return new Set(); }
}
function toggleSaved(id: string): boolean {
  const s = readSaved();
  if (s.has(id)) s.delete(id); else s.add(id);
  try { localStorage.setItem(SAVED_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
  return s.has(id);
}

type FilterKey = 'all' | 'mine' | 'week' | 'month';

export function Events() {
  const { t } = useTranslation();
  const [seg, setSeg] = useState<'list' | 'map'>('list');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const eventsQ = useEvents();

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('events.filterAll', 'All') },
    { key: 'mine', label: t('events.filterMine', 'My Area') },
    { key: 'week', label: t('events.filterWeek', 'This Week') },
    { key: 'month', label: t('events.filterMonth', 'This Month') },
  ];

  return (
    <div className="fade-up">
      {/* ---- Header ---- */}
      <header style={{ padding: '18px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ font: `800 28px/1.1 ${font.head}`, letterSpacing: '-0.01em', color: c.ink0, margin: 0 }}>{t('events.title')}</h1>
            <p style={{ font: `400 13px/1.45 ${font.ui}`, color: c.ink2, margin: '6px 0 0' }}>
              {t('events.subtitle', 'Community events, programs and opportunities near you')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
            <button type="button" className="ev-iconbtn" aria-label={t('events.search', 'Search events')} aria-pressed={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
              <Icon name="search" size={20} color={c.ink} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('events.searchPlaceholder', 'Search by title or venue')}
            aria-label={t('events.search', 'Search events')}
            autoFocus
            style={{ width: '100%', height: 46, marginTop: 12, borderRadius: radius.md, border: `1px solid ${c.hairline2}`, background: c.card, color: c.ink, font: `400 15px/1 ${font.ui}`, padding: '0 14px', boxSizing: 'border-box' }}
          />
        )}
      </header>

      {/* ---- Segmented control ---- */}
      <div style={{ padding: '14px 16px 0' }}>
        <div role="tablist" aria-label={t('events.view', 'Event view')} style={{ display: 'flex', background: c.surfaceVariant, borderRadius: radius.pill, padding: 4 }}>
          {(['list', 'map'] as const).map((s) => {
            const on = seg === s;
            return (
              <button key={s} role="tab" aria-selected={on} onClick={() => setSeg(s)}
                style={{ flex: 1, height: 44, borderRadius: radius.pill, border: 'none', cursor: 'pointer', background: on ? c.primary : 'transparent', color: on ? '#fff' : c.ink2, font: `700 14px/1 ${font.ui}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Icon name={s === 'list' ? 'calendar' : 'mapPin'} size={17} color={on ? '#fff' : c.ink2} />
                {t(`events.${s}View`, s === 'list' ? 'List View' : 'Map View')}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Filter chips ---- */}
      <div role="group" aria-label={t('events.filters', 'Filter events')} style={{ display: 'flex', gap: 8, padding: '14px 16px 4px', overflowX: 'auto' }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button key={f.key} type="button" aria-pressed={on} onClick={() => setFilter(f.key)}
              style={{ flex: 'none', height: 40, padding: '0 16px', borderRadius: radius.pill, cursor: 'pointer', border: `1px solid ${on ? c.primary : c.hairline2}`, background: on ? c.primary : c.card, color: on ? '#fff' : c.ink, font: `600 13.5px/1 ${font.ui}` }}>
              {f.label}
            </button>
          );
        })}
      </div>

      <QueryBoundary query={eventsQ}>
        {(events) => {
          const now = Date.now();
          const weekMs = 7 * 864e5;
          const monthMs = 31 * 864e5;
          const q = search.trim().toLowerCase();
          const list = events
            .filter((e) => Date.parse(e.startsAt) >= now - 864e5)
            .filter((e) => {
              if (filter === 'mine' && !e.isMine) return false;
              if (filter === 'week' && Date.parse(e.startsAt) - now > weekMs) return false;
              if (filter === 'month' && Date.parse(e.startsAt) - now > monthMs) return false;
              return true;
            })
            .filter((e) => !q || `${e.titleEn} ${e.titleTa} ${e.venue}`.toLowerCase().includes(q))
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

          if (seg === 'map') return <EventsMap events={list} />;

          return (
            <section style={{ padding: '14px 16px 24px' }} aria-label={t('events.upcoming', 'Upcoming events')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ font: `700 18px/1.2 ${font.head}`, color: c.ink0, margin: 0 }}>{t('events.upcoming', 'Upcoming events')}</h2>
              </div>
              {list.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {list.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              ) : (
                <div className="home-empty">
                  <Icon name="calendar" size={28} color={c.ink3} />
                  <div style={{ font: `600 15px/1.4 ${font.ta}`, color: c.ink }}>{t('events.none', 'No events found')}</div>
                  <div style={{ font: `400 13px/1.5 ${font.ui}`, color: c.ink3, maxWidth: 240 }}>{t('events.noneSub', 'Try a different filter or check back soon.')}</div>
                </div>
              )}
            </section>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function EventCard({ event }: { event: NpmEvent }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rsvp = useSetRsvp();
  const [going, setGoing] = useState(() => currentRsvp(event.id) === 'going');
  const [saved, setSaved] = useState(() => readSaved().has(event.id));

  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const cat = catOf(event.category);
  const title = pick(lang, event.titleTa, event.titleEn) || event.titleEn || event.titleTa;
  const timeStr = `${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}${end ? ` – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}` : ''}`;
  const rsvpCount = event.rsvpCount + (going && currentRsvp(event.id) !== 'going' ? 1 : 0);

  const open = () => navigate(`/events/${event.id}`);

  return (
    <article style={{ display: 'flex', background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, overflow: 'hidden', boxShadow: '0 3px 12px rgba(15,35,60,.06)' }}>
      {/* thumbnail + date */}
      <div style={{ position: 'relative', flex: 'none', width: 108, background: cat.grad, display: 'grid', placeItems: 'center' }}>
        <Icon name={cat.icon} size={34} color="rgba(255,255,255,.9)" strokeWidth={1.7} />
        <time dateTime={event.startsAt} style={{ position: 'absolute', top: 0, left: 0, background: c.primary, color: '#fff', borderRadius: '0 0 12px 0', padding: '7px 10px 8px', textAlign: 'center', lineHeight: 1 }}>
          <strong style={{ display: 'block', font: `800 18px/1 ${font.head}` }}>{start.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'Asia/Colombo' })}</strong>
          <span style={{ display: 'block', font: `700 9px/1 ${font.ui}`, letterSpacing: '.1em', marginTop: 3 }}>{start.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Asia/Colombo' }).toUpperCase()}</span>
          <span style={{ display: 'block', font: `600 9px/1 ${font.ui}`, opacity: .85, marginTop: 2 }}>{start.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Asia/Colombo' })}</span>
        </time>
      </div>

      {/* body */}
      <div style={{ flex: 1, minWidth: 0, padding: '12px 12px 12px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px', borderRadius: radius.pill, background: cat.bg, color: cat.fg, font: `700 11px/1 ${font.ui}` }}>
            <Icon name={cat.icon} size={12} color={cat.fg} strokeWidth={2.2} />
            {t(`events.cat.${(event.category || 'event').toLowerCase()}`, cat.label)}
          </span>
          <button type="button" aria-label={saved ? t('events.unsave', 'Remove bookmark') : t('events.save', 'Bookmark event')} aria-pressed={saved}
            onClick={() => setSaved(toggleSaved(event.id))}
            style={{ flex: 'none', width: 32, height: 32, marginRight: -4, marginTop: -2, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon name="bookmark" size={18} color={saved ? c.primary : c.ink3} fill={saved ? c.primary : 'none'} strokeWidth={2} />
          </button>
        </div>

        <button type="button" onClick={open} style={{ textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', margin: '6px 0 0' }}>
          <h3 style={{ font: `700 15.5px/1.3 ${font.ta}`, color: c.ink0, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</h3>
        </button>

        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: 7, font: `400 12.5px/1.3 ${font.ui}`, color: c.ink2 }}>
            <Icon name="mapPin" size={14} color={c.ink3} strokeWidth={2} style={{ flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.venue}</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 7, font: `400 12.5px/1.3 ${font.ui}`, color: c.ink2 }}>
            <Icon name="clock" size={14} color={c.ink3} strokeWidth={2} style={{ flex: 'none' }} />
            {timeStr}
          </li>
        </ul>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `500 12px/1 ${font.ui}`, color: c.ink2 }}>
            <Icon name="users" size={14} color={c.ink3} strokeWidth={2} />
            {t('events.rsvps', { count: rsvpCount })}
          </span>
          <button type="button"
            onClick={() => { const next = !going; setGoing(next); rsvp.mutate({ eventId: event.id, status: next ? 'going' : null }); }}
            aria-pressed={going}
            style={{ flex: 'none', height: 40, padding: '0 16px', borderRadius: radius.pill, cursor: 'pointer', border: 'none', background: going ? c.success : c.primary, color: '#fff', font: `700 13.5px/1 ${font.ui}`, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {going ? t('common.going', 'Going') : t('common.rsvp', 'RSVP')}
            <Icon name={going ? 'check' : 'chevron'} size={15} color="#fff" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </article>
  );
}

function EventsMap({ events }: { events: NpmEvent[] }) {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const center = useMemo<[number, number]>(() => {
    if (!events.length) return [9.6685, 80.0074];
    const lat = events.reduce((s, e) => s + e.lat, 0) / events.length;
    const lng = events.reduce((s, e) => s + e.lng, 0) / events.length;
    return [lat, lng];
  }, [events]);

  return (
    <div style={{ padding: '14px 16px 24px' }}>
      <div style={{ height: 420, borderRadius: radius.lg, overflow: 'hidden', border: `1px solid ${c.hairline}` }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {events.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={eventPin}>
              <Popup>
                <div style={{ font: `600 13px/1.3 ${font.ta}` }}>{pick(lang, e.titleTa, e.titleEn)}</div>
                <div style={{ font: `400 12px/1.3 ${font.ui}`, color: c.ink2 }}>{e.venue}</div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
