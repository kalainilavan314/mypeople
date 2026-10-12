import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { Bell, MapPin, Search, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
type Props = {
  name: string;
  avatarUrl?: string | null;
  location: string;
  search: string;
  onSearch: (value: string) => void;
};
export function HomeHeader({ name, avatarUrl, location, search, onSearch }: Props) {
  const t = useWorkspaceText();
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Colombo',
    }).format(new Date()),
  );
  const greeting =
    hour < 12
      ? t('Good morning', 'காலை வணக்கம்')
      : hour < 17
        ? t('Good afternoon', 'மதிய வணக்கம்')
        : t('Good evening', 'மாலை வணக்கம்');
  return (
    <header className="home-header">
      <div className="home-header-row">
        <Link
          className="home-avatar"
          to="/profile"
          aria-label={t('Your profile', 'உங்கள் சுயவிவரம்')}
        >
          <UserRound size={22} aria-hidden="true" />
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
        </Link>
        <div className="home-greeting">
          <span className="home-brand">{greeting}</span>
          <h1>{name}</h1>
          <p>
            <MapPin size={13} aria-hidden="true" />
            <span>{location}</span>
          </p>
        </div>
        <div className="home-header-controls">
          <Link to="/notifications" aria-label={t('Notifications', 'அறிவிப்புகள்')}>
            <Bell size={20} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="home-search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label={t('Search activities', 'செயல்களைத் தேடு')}
          placeholder={t('Search your community', 'உங்கள் சமூகத்தில் தேடுங்கள்')}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            aria-label={t('Clear search', 'தேடலை அழி')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
