import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, QueryBoundary, StatusPill } from '../components/ui';
import { QR, checkInToken } from '../lib/qr';
import { useCheckIn, useEvent, useMember, useSetRsvp } from '../data/queries';
import { currentRsvp } from '../data/mock/client';

const pin = L.divIcon({ className: '', html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#E8A838;transform:rotate(-45deg);border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(201,143,38,.5)"></div>`, iconSize: [24, 24], iconAnchor: [12, 24] });

export function EventDetail() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const eventQ = useEvent(id);
  const memberQ = useMember();
  const rsvp = useSetRsvp();
  const checkIn = useCheckIn();
  const [going, setGoing] = useState(() => currentRsvp(id) === 'going');
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <div>
      <ScreenHeader titleTa="நிகழ்வு" titleEn="Event" />
      <QueryBoundary query={eventQ}>
        {(e) =>
          e ? (
            <div style={{ padding: '0 0 28px' }}>
              <div style={{ height: 180 }}>
                <MapContainer center={[e.lat, e.lng]} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} dragging={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  <Marker position={[e.lat, e.lng]} icon={pin} />
                </MapContainer>
              </div>
              <div style={{ padding: '18px 16px' }}>
                <h1 style={{ font: `700 21px/1.4 ${font.ta}`, color: c.ink, margin: 0 }}>{pick(lang, e.titleTa, e.titleEn)}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, font: `400 13px/1.4 ${font.ui}`, color: c.ink2 }}>
                  <Icon name="mapPin" size={16} color={c.ink3} strokeWidth={2} />
                  {e.venue}
                </div>

                {/* Agenda */}
                <div style={{ font: `600 14px/1 ${font.ta}`, color: c.ink, margin: '22px 0 12px' }}>{t('events.agenda')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {e.agenda.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ width: 12, height: 12, borderRadius: 999, background: c.maroon, marginTop: 4 }} />
                        {i < e.agenda.length - 1 && <span style={{ flex: 1, width: 2, background: c.hairline }} />}
                      </div>
                      <div style={{ paddingBottom: 16 }}>
                        <div style={{ font: `600 13px/1 ${font.mono}`, color: c.maroon }}>{a.time}</div>
                        <div style={{ font: `500 14px/1.4 ${font.ta}`, color: c.ink, marginTop: 3 }}>{pick(lang, a.labelTa, a.labelEn)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Check-in */}
                <div style={{ background: c.cardCream, borderRadius: radius.lg, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  {checkedIn ? (
                    <>
                      <div style={{ width: 56, height: 56, borderRadius: 999, background: c.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="check" size={28} color="#FFFFFF" strokeWidth={2.4} />
                      </div>
                      <div style={{ font: `600 16px/1.3 ${font.ta}`, color: c.ink }}>{t('events.checkedIn')}</div>
                      <StatusPill label={t('events.pointsForCheckin')} tone="success" icon="star" />
                    </>
                  ) : (
                    <QueryBoundary query={memberQ}>
                      {(m) => (
                        <>
                          <QR value={checkInToken(m.memberCode, e.id)} size={140} />
                          <div style={{ font: `400 12px/1.4 ${font.ui}`, color: c.ink3, textAlign: 'center' }}>{t('card.checkInQr')}</div>
                          <Button variant="primary" fullWidth onClick={() => { checkIn.mutate(e.id); setCheckedIn(true); }}>{t('events.checkIn')}</Button>
                        </>
                      )}
                    </QueryBoundary>
                  )}
                </div>

                {/* RSVP */}
                <div style={{ marginTop: 16 }}>
                  <Button fullWidth variant={going ? 'success' : 'primary'} icon={going ? 'check' : undefined} onClick={() => { const n = !going; setGoing(n); rsvp.mutate({ eventId: e.id, status: n ? 'going' : null }); }}>
                    {going ? t('common.going') : t('common.rsvp')} · {t('events.rsvps', { count: e.rsvpCount + (going && currentRsvp(e.id) !== 'going' ? 1 : 0) })}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 24 }}>{t('common.empty')}</div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
