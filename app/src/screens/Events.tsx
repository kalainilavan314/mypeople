import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon } from '../components/Icon';
import { QueryBoundary } from '../components/ui';
import { useEvents, useSetRsvp } from '../data/queries';
import { DateBadge } from '../components/Civic';
import type { NpmEvent } from '../data/types';

const eventPin = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#0F2942;transform:rotate(-45deg);border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(15,41,66,.5)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
});

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
    <main className="civic-page">
      {/* ---- Header ---- */}
      <header style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ font: `700 1.375rem/1.4 ${font.head}`, letterSpacing: '-0.01em', color: c.ink0, margin: 0 }}>{t('events.title')}</h1>
            <p style={{ font: `400 0.8125rem/1.45 ${font.ui}`, color: c.ink2, margin: '6px 0 0' }}>
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
            style={{ width: '100%', height: 46, marginTop: 12, borderRadius: radius.md, border: `1px solid ${c.hairline2}`, background: c.card, color: c.ink, font: `400 0.9375rem/1 ${font.ui}`, padding: '0 14px', boxSizing: 'border-box' }}
          />
        )}
      </header>

      {/* ---- Segmented control ---- */}
      <div style={{ padding: '16px 0 0' }}>
        <div role="group" aria-label={t('events.view', 'Event view')} style={{ display: 'flex', background: c.surfaceVariant, borderRadius: radius.sm, padding: 4 }}>
          {(['list', 'map'] as const).map((s) => {
            const on = seg === s;
            return (
              <button key={s} type="button" aria-pressed={on} onClick={() => setSeg(s)}
                style={{ flex: 1, minHeight: 44, borderRadius: radius.sm, border: 'none', cursor: 'pointer', background: on ? c.primary : 'transparent', color: on ? c.onPrimary : c.ink2, font: `700 0.875rem/1 ${font.ui}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Icon name={s === 'list' ? 'calendar' : 'mapPin'} size={17} color={on ? '#fff' : c.ink2} />
                {t(`events.${s}View`, s === 'list' ? 'List View' : 'Map View')}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Filter chips ---- */}
      <div role="group" aria-label={t('events.filters', 'Filter events')} style={{ display: 'flex', gap: 8, padding: '16px 0 4px', overflowX: 'auto' }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button key={f.key} type="button" aria-pressed={on} onClick={() => setFilter(f.key)}
              style={{ flex: 'none', minHeight: 44, padding: '8px 16px', borderRadius: radius.pill, cursor: 'pointer', border: `1px solid ${on ? c.primary : c.hairline2}`, background: on ? c.primary : c.card, color: on ? c.onPrimary : c.ink2, font: `600 0.8125rem/1.5 ${font.ui}` }}>
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
            <section style={{ padding: '16px 0 24px' }} aria-label={t('events.upcoming', 'Upcoming events')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ font: `700 1.125rem/1.2 ${font.head}`, color: c.ink0, margin: 0 }}>{t('events.upcoming', 'Upcoming events')}</h2>
              </div>
              {list.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {list.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              ) : (
                <div className="home-empty">
                  <Icon name="calendar" size={28} color={c.ink3} />
                  <div style={{ font: `600 0.9375rem/1.4 ${font.ta}`, color: c.ink }}>{t('events.none', 'No events found')}</div>
                  <div style={{ font: `400 0.8125rem/1.5 ${font.ui}`, color: c.ink3, maxWidth: 240 }}>{t('events.noneSub', 'Try a different filter or check back soon.')}</div>
                </div>
              )}
            </section>
          );
        }}
      </QueryBoundary>
    </main>
  );
}

function EventCard({ event }: { event: NpmEvent }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rsvp = useSetRsvp();
  const [going, setGoing] = useState(event.myStatus === 'going');
  useEffect(() => { setGoing(event.myStatus === 'going'); }, [event.myStatus]);
  const [saved, setSaved] = useState(() => readSaved().has(event.id));

  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const title = pick(lang, event.titleTa, event.titleEn) || event.titleEn || event.titleTa;
  const timeStr = `${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}${end ? ` – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}` : ''}`;
  const rsvpCount = event.rsvpCount;

  const open = () => navigate(`/events/${event.id}`);

  // Clean white card: a compact date badge on the left, details on the right,
  // RSVP right-aligned. No split dark/light block (spec defect fix).
  return (
    <article style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, padding: 12, boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {/* date badge */}
        <DateBadge iso={event.startsAt} />

        {/* content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <button className="civic-event-title" type="button" onClick={open} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
              <h3 style={{ font: `700 0.8125rem/1.5 ${font.ui}`, color: c.ink0, margin: 0, overflowWrap: 'anywhere' }}>{title}</h3>
            </button>
            <button type="button" aria-label={saved ? t('events.unsave', 'Remove bookmark') : t('events.save', 'Bookmark event')} aria-pressed={saved}
              onClick={() => setSaved(toggleSaved(event.id))}
              style={{ flex: 'none', width: 44, height: 44, borderRadius: radius.sm, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <Icon name="bookmark" size={17} color={saved ? c.primary : c.ink3} fill={saved ? c.primary : 'none'} strokeWidth={2} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, font: `400 0.78125rem/1.3 ${font.ui}`, color: c.ink2 }}>
            <Icon name="mapPin" size={13} color={c.ink3} strokeWidth={2} style={{ flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.venue}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, font: `400 0.78125rem/1.3 ${font.ui}`, color: c.ink2 }}>
            <Icon name="clock" size={13} color={c.ink3} strokeWidth={2} style={{ flex: 'none' }} />
            <span>{timeStr}</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `500 0.75rem/1 ${font.ui}`, color: c.ink3 }}>
              <Icon name="users" size={13} color={c.ink3} strokeWidth={2} />
              {t('events.rsvps', { count: rsvpCount })}
            </span>
            <button type="button"
              disabled={rsvp.isPending}
              onClick={() => { const next = !going; rsvp.mutate({ eventId: event.id, status: next ? 'going' : null }, { onSuccess: () => setGoing(next) }); }}
              aria-pressed={going}
              style={{ flex: 'none', minHeight: 44, padding: '8px 16px', borderRadius: radius.sm, cursor: 'pointer', border: going ? `1px solid ${c.success}` : 'none', background: going ? c.successBg : c.primary, color: going ? c.success : c.onPrimary, font: `600 0.8125rem/1.5 ${font.ui}`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {rsvp.isPending ? t('common.saving', 'Saving…') : going ? t('common.going', 'Going') : t('common.rsvp', 'RSVP')}
              <Icon name={going ? 'check' : 'chevron'} size={14} color={going ? c.success : '#fff'} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
      {rsvp.isError && <p className="civic-error" role="alert">{t('events.rsvpError', 'Your response could not be saved. Please try again.')}</p>}
      <span className="sr-only" role="status">{rsvp.isSuccess ? t('events.rsvpSaved', 'Response saved') : ''}</span>
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
    <div style={{ padding: '16px 0 24px' }}>
      <div style={{ height: 420, borderRadius: radius.lg, overflow: 'hidden', border: `1px solid ${c.hairline}` }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {events.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={eventPin}>
              <Popup>
                <div style={{ font: `600 0.8125rem/1.3 ${font.ta}` }}>{pick(lang, e.titleTa, e.titleEn)}</div>
                <div style={{ font: `400 0.75rem/1.3 ${font.ui}`, color: c.ink2 }}>{e.venue}</div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
