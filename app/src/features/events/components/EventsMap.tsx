import type { NpmEvent } from '@/core/api/types';
import { pick } from '@/core/i18n';
import { c, font, radius } from '@/core/theme/tokens';
import { eventPin } from '@/features/events/Events.model';
import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
export function EventsMap({ events }: { events: NpmEvent[] }) {
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
      <div
        style={{
          height: 420,
          borderRadius: radius.lg,
          overflow: 'hidden',
          border: `1px solid ${c.hairline}`,
        }}
      >
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {events.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={eventPin}>
              <Popup>
                <div style={{ font: `600 0.8125rem/1.3 ${font.ta}` }}>
                  {pick(lang, e.titleTa, e.titleEn)}
                </div>
                <div style={{ font: `400 0.75rem/1.3 ${font.ui}`, color: c.ink2 }}>{e.venue}</div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
