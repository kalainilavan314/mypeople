import { useEvents } from '@/core/api/queries';
import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { ArrowUpRight, Check, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
type Events = NonNullable<ReturnType<typeof useEvents>['data']>;
export function NearbyEvents({ events }: { events: Events }) {
  const t = useWorkspaceText();
  if (!events.length)
    return (
      <div className="home-empty">
        <p>{t('No upcoming events.', 'வரவிருக்கும் நிகழ்வுகள் இல்லை.')}</p>
        <Link to="/events">{t('View events', 'நிகழ்வுகளைக் காண்க')}</Link>
      </div>
    );
  return (
    <div className="home-event-list">
      {events.map((event) => (
        <Link key={event.id} to={'/events/' + event.id} className="home-event-row">
          <time className="home-date" dateTime={event.startsAt}>
            <span>
              {new Date(event.startsAt).toLocaleDateString('en-GB', {
                month: 'short',
                timeZone: 'Asia/Colombo',
              })}
            </span>
            <strong>
              {new Date(event.startsAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                timeZone: 'Asia/Colombo',
              })}
            </strong>
          </time>
          <div>
            <strong>{t(event.titleEn, event.titleTa)}</strong>
            <p>
              <MapPin size={16} aria-hidden="true" />
              {event.venue}
            </p>
            <small>
              {new Date(event.startsAt).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Colombo',
              })}
              {event.myStatus === 'going' && (
                <span className="home-going">
                  <Check size={14} aria-hidden="true" />
                  {t('Going', 'செல்கிறேன்')}
                </span>
              )}
            </small>
          </div>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
