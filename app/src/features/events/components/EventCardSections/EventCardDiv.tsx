import type { NpmEvent } from '@/core/api/types';
import { c, font, radius } from '@/core/theme/tokens';
import { toggleSaved } from '@/features/events/Events.model';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import 'leaflet/dist/leaflet.css';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  open: () => void;
  title: string;
  saved: boolean;
  t: TFunction<'translation', undefined>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  event: NpmEvent;
};
export function EventCardDiv({ open, title, saved, t, setSaved, event }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <button
        className="civic-event-title"
        type="button"
        onClick={open}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'none',
          border: 0,
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <h3
          style={{
            font: `700 0.8125rem/1.5 ${font.ui}`,
            color: c.ink0,
            margin: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </h3>
      </button>
      <button
        type="button"
        aria-label={
          saved ? t('events.unsave', 'Remove bookmark') : t('events.save', 'Bookmark event')
        }
        aria-pressed={saved}
        onClick={() => setSaved(toggleSaved(event.id))}
        style={{
          flex: 'none',
          width: 44,
          height: 44,
          borderRadius: radius.sm,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon
          name="bookmark"
          size={17}
          color={saved ? c.primary : c.ink3}
          fill={saved ? c.primary : 'none'}
          strokeWidth={2}
        />
      </button>
    </div>
  );
}
