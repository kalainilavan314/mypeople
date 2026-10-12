import { c, font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import 'leaflet/dist/leaflet.css';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
};
export function EventsHeader({ t, searchOpen, setSearchOpen, search, setSearch }: Props) {
  return (
    <header style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              font: `700 1.375rem/1.4 ${font.head}`,
              letterSpacing: '-0.01em',
              color: c.ink0,
              margin: 0,
            }}
          >
            {t('events.title')}
          </h1>
          <p style={{ font: `400 0.8125rem/1.45 ${font.ui}`, color: c.ink2, margin: '6px 0 0' }}>
            {t('events.subtitle', 'Community events, programs and opportunities near you')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <button
            type="button"
            className="ev-iconbtn"
            aria-label={t('events.search', 'Search events')}
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
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
          style={{
            width: '100%',
            height: 46,
            marginTop: 12,
            borderRadius: radius.md,
            border: `1px solid ${c.hairline2}`,
            background: c.card,
            color: c.ink,
            font: `400 0.9375rem/1 ${font.ui}`,
            padding: '0 14px',
            boxSizing: 'border-box',
          }}
        />
      )}
    </header>
  );
}
