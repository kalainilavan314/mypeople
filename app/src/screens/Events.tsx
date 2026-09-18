import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { c, font, radius, shadow } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon } from '../components/Icon';
import { Chip, QueryBoundary } from '../components/ui';
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

export function Events() {
  const { t } = useTranslation();
  const [seg, setSeg] = useState<'list' | 'map'>('list');
  const [filters, setFilters] = useState({ mine: false, district: false, week: false });
  const eventsQ = useEvents();

  const toggle = (k: keyof typeof filters) => setFilters((f) => ({ ...f, [k]: !f[k] }));

  return (
    <div className="fade-up">
      <div style={{ padding: '18px 16px 0' }}>
        <div style={{ font: `700 22px/1.2 ${font.ta}`, color: c.ink }}>{t('events.title')}</div>
      </div>

      {/* Segmented control */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', background: c.cardCream, borderRadius: radius.pill, padding: 4 }}>
          {(['list', 'map'] as const).map((s) => (
            <button key={s} onClick={() => setSeg(s)} style={{ flex: 1, height: 40, borderRadius: radius.pill, border: 'none', cursor: 'pointer', background: seg === s ? c.card : 'transparent', color: seg === s ? c.maroon : c.ink3, font: `600 14px/1 ${font.ta}`, boxShadow: seg === s ? '0 2px 8px rgba(35,55,80,.12)' : 'none' }}>
              {t(`events.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 4px', overflowX: 'auto' }}>
        <Chip label={t('events.filterMine')} active={filters.mine} onClick={() => toggle('mine')} />
        <Chip label={t('events.filterDistrict')} active={filters.district} onClick={() => toggle('district')} />
        <Chip label={t('events.filterWeek')} active={filters.week} onClick={() => toggle('week')} />
      </div>

      <QueryBoundary query={eventsQ}>
        {(events) => {
          const weekMs = 7 * 24 * 3600 * 1000;
          const now = Date.now();
          const list = events.filter((e) => {
            if (filters.mine && !e.isMine) return false;
            if (filters.week && new Date(e.startsAt).getTime() - now > weekMs) return false;
            return true;
          });
          return seg === 'map' ? <EventsMap events={list} /> : <EventsList events={list} />;
        }}
      </QueryBoundary>
    </div>
  );
}

function EventsList({ events }: { events: NpmEvent[] }) {
  return (
    <div style={{ padding: '10px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  );
}

function EventCard({ event }: { event: NpmEvent }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rsvp = useSetRsvp();
  const [going, setGoing] = useState(() => currentRsvp(event.id) === 'going');
  const start = new Date(event.startsAt);

  return (
    <div style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, boxShadow: shadow.card, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 14, padding: 16 }}>
        <div style={{ flex: 'none', width: 54, borderRadius: radius.sm, background: c.maroonTint, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
          <span style={{ font: `700 20px/1 ${font.ui}`, color: c.maroon }}>{start.getDate()}</span>
          <span style={{ font: `600 11px/1 ${font.ui}`, color: c.maroonHover, textTransform: 'uppercase', marginTop: 3 }}>{start.toLocaleDateString('en-GB', { month: 'short' })}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => navigate(`/events/${event.id}`)}>
          <div style={{ font: `600 15px/1.35 ${font.ta}`, color: c.ink, cursor: 'pointer' }}>{pick(lang, event.titleTa, event.titleEn)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, font: `400 12px/1.4 ${font.ui}`, color: c.ink3 }}>
            <Icon name="mapPin" size={14} color={c.ink3} strokeWidth={2} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.venue}</span>
          </div>
          <div style={{ font: `400 12px/1.4 ${font.ui}`, color: c.ink3, marginTop: 3 }}>
            {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {t('events.rsvps', { count: event.rsvpCount + (going && currentRsvp(event.id) !== 'going' ? 1 : 0) })}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
        <button
          onClick={() => {
            const next = !going;
            setGoing(next);
            rsvp.mutate({ eventId: event.id, status: next ? 'going' : null });
          }}
          style={{ flex: 1, height: 46, borderRadius: 999, cursor: 'pointer', border: `1px solid ${going ? c.success : c.maroon}`, background: going ? c.success : c.maroon, color: '#FFFFFF', font: `600 14px/1 ${font.ta}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {going && <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.4} />}
          {going ? t('common.going') : t('common.rsvp')}
        </button>
        <button onClick={() => navigate(`/events/${event.id}`)} style={{ flex: 'none', width: 46, height: 46, borderRadius: 999, border: `1px solid ${c.hairline}`, background: c.page, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label={t('common.directions')}>
          <Icon name="mapPin" size={18} color={c.ink2} />
        </button>
      </div>
    </div>
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
    <div style={{ padding: '10px 16px 24px' }}>
      <div style={{ height: 420, borderRadius: radius.lg, overflow: 'hidden', border: `1px solid ${c.hairline}` }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
