import { useEvents } from '@/core/api/queries';
import { c, font, radius } from '@/core/theme/tokens';
import { FilterKey } from '@/features/events/Events.model';
import { EventCard } from '@/features/events/components/EventCard';
import { EventsHeader } from '@/features/events/components/EventsHeader';
import { EventsMap } from '@/features/events/components/EventsMap';
import { Icon } from '@/shared/components/Icon';
import { QueryBoundary } from '@/shared/components/ui';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
    { key: 'month', label: t('events.filterMonth', 'This month') },
  ];

  return (
    <main className="civic-page">
      <EventsHeader
        t={t}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        search={search}
        setSearch={setSearch}
      />

      <div style={{ padding: '16px 0 0' }}>
        <div
          role="group"
          aria-label={t('events.view', 'Event view')}
          style={{
            display: 'flex',
            background: c.surfaceVariant,
            borderRadius: radius.sm,
            padding: 4,
          }}
        >
          {(['list', 'map'] as const).map((s) => {
            const on = seg === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setSeg(s)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: radius.sm,
                  border: 'none',
                  cursor: 'pointer',
                  background: on ? c.primary : 'transparent',
                  color: on ? c.onPrimary : c.ink2,
                  font: `700 0.875rem/1 ${font.ui}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                }}
              >
                <Icon
                  name={s === 'list' ? 'calendar' : 'mapPin'}
                  size={17}
                  color={on ? '#fff' : c.ink2}
                />
                {t(`events.${s}View`, s === 'list' ? 'List View' : 'Map View')}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="group"
        aria-label={t('events.filters', 'Filter events')}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '16px 0 4px' }}
      >
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              style={{
                flex: 'none',
                minHeight: 44,
                padding: '8px 16px',
                borderRadius: radius.pill,
                cursor: 'pointer',
                border: `1px solid ${on ? c.primary : c.hairline2}`,
                background: on ? c.primary : c.card,
                color: on ? c.onPrimary : c.ink2,
                font: `600 0.8125rem/1.5 ${font.ui}`,
              }}
            >
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
          const narrowed = filter !== 'all' || q.length > 0;

          return (
            <section
              style={{ padding: '16px 0 24px' }}
              aria-label={t('events.upcoming', 'Upcoming events')}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <h2 style={{ font: `700 1.125rem/1.2 ${font.head}`, color: c.ink0, margin: 0 }}>
                  {t('events.upcoming', 'Upcoming events')}
                </h2>
              </div>
              {list.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {list.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <div className="home-empty">
                  <Icon name="calendar" size={28} color={c.ink3} />
                  <div style={{ font: `600 0.9375rem/1.4 ${font.ta}`, color: c.ink }}>
                    {narrowed
                      ? t('events.noneMatch', 'No events match')
                      : t('events.noneYet', 'No upcoming events yet')}
                  </div>
                  <div
                    style={{ font: `400 0.8125rem/1.5 ${font.ui}`, color: c.ink3, maxWidth: 260 }}
                  >
                    {narrowed
                      ? t('events.noneMatchSub', 'Other events may be on. Show them all instead.')
                      : t(
                          'events.noneYetSub',
                          'New events appear here as soon as they are announced. Photos of past events are in the gallery.',
                        )}
                  </div>
                  {narrowed ? (
                    <button
                      type="button"
                      className="home-empty-card-btn"
                      onClick={() => {
                        setFilter('all');
                        setSearch('');
                      }}
                    >
                      {t('events.showAll', 'Show all events')}
                    </button>
                  ) : (
                    <Link to="/gallery" className="home-empty-card-btn">
                      {t('events.openGallery', 'See past events')}
                    </Link>
                  )}
                </div>
              )}
            </section>
          );
        }}
      </QueryBoundary>
    </main>
  );
}
