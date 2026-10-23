import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { Bell, Search, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
type Props = {
  name: string;
  avatarUrl?: string | null;
  search: string;
  onSearch: (value: string) => void;
};
export function HomeHeader({ name, avatarUrl, search, onSearch }: Props) {
  const t = useWorkspaceText();
  const greeting = t('Welcome', 'வணக்கம்');
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
