import { useSetRsvp } from '@/core/api/queries';
import type { NpmEvent } from '@/core/api/types';
import { pick } from '@/core/i18n';
import { c, font, radius } from '@/core/theme/tokens';
import { EventCardDiv } from '@/features/events/components/EventCardSections/EventCardDiv';
import { readSaved } from '@/features/events/Events.model';
import { DateBadge } from '@/shared/components/Civic';
import { Icon } from '@/shared/components/Icon';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
export function EventCard({ event }: { event: NpmEvent }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rsvp = useSetRsvp();
  const [going, setGoing] = useState(event.myStatus === 'going');
  useEffect(() => {
    setGoing(event.myStatus === 'going');
  }, [event.myStatus]);
  const [saved, setSaved] = useState(() => readSaved().has(event.id));

  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const title = pick(lang, event.titleTa, event.titleEn) || event.titleEn || event.titleTa;
  const timeStr = `${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}${end ? ` – ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}` : ''}`;
  const rsvpCount = event.rsvpCount;

  const open = () => navigate(`/events/${event.id}`);

  return (
    <article
      style={{
        background: c.card,
        border: `1px solid ${c.hairline}`,
        borderRadius: radius.lg,
        padding: 12,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <DateBadge iso={event.startsAt} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <EventCardDiv
            open={open}
            title={title}
            saved={saved}
            t={t}
            setSaved={setSaved}
            event={event}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 5,
              font: `400 0.78125rem/1.3 ${font.ui}`,
              color: c.ink2,
            }}
          >
            <Icon name="mapPin" size={13} color={c.ink3} strokeWidth={2} style={{ flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.venue}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 3,
              font: `400 0.78125rem/1.3 ${font.ui}`,
              color: c.ink2,
            }}
          >
            <Icon name="clock" size={13} color={c.ink3} strokeWidth={2} style={{ flex: 'none' }} />
            <span>{timeStr}</span>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 8,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                font: `500 0.75rem/1 ${font.ui}`,
                color: c.ink3,
              }}
            >
              <Icon name="users" size={13} color={c.ink3} strokeWidth={2} />
              {t('events.rsvps', { count: rsvpCount })}
            </span>
            <button
              type="button"
              disabled={rsvp.isPending}
              onClick={() => {
                const next = !going;
                rsvp.mutate(
                  { eventId: event.id, status: next ? 'going' : null },
                  { onSuccess: () => setGoing(next) },
                );
              }}
              aria-pressed={going}
              style={{
                flex: 'none',
                minHeight: 44,
                padding: '8px 16px',
                borderRadius: radius.sm,
                cursor: 'pointer',
                border: going ? `1px solid ${c.success}` : 'none',
                background: going ? c.successBg : c.primary,
                color: going ? c.success : c.onPrimary,
                font: `600 0.8125rem/1.5 ${font.ui}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {rsvp.isPending
                ? t('common.saving', 'Saving…')
                : going
                  ? t('common.going', 'Going')
                  : t('common.rsvp', 'RSVP')}
              <Icon
                name={going ? 'check' : 'chevron'}
                size={14}
                color={going ? c.success : '#fff'}
                strokeWidth={2.4}
              />
            </button>
          </div>
        </div>
      </div>
      {rsvp.isError && (
        <p className="civic-error" role="alert">
          {t('events.rsvpError', 'Your response could not be saved. Please try again.')}
        </p>
      )}
      <span className="sr-only" role="status">
        {rsvp.isSuccess ? t('events.rsvpSaved', 'Response saved') : ''}
      </span>
    </article>
  );
}
