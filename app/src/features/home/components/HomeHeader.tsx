import { useNotifications } from '@/core/api/queries';
import { setSavedLang } from '@/core/i18n';
import { Logo } from '@/shared/components/Logo';
import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { Bell, Search, UserRound, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

type Props = {
  avatarUrl?: string | null;
  search: string;
  onSearch: (value: string) => void;
};

/**
 * The Home top bar: a dark navy band with rounded lower corners, the brand small in the
 * middle, the language switch on the left, and notifications and the profile on the
 * right. No greeting or name: the bar is for finding your way, not for reading.
 */
export function HomeHeader({ avatarUrl, search, onSearch }: Props) {
  const t = useWorkspaceText();
  const { i18n } = useTranslation();
  const notifications = useNotifications();
  const unread = (notifications.data ?? []).some((n) => n.readAt === null);
  const english = !i18n.language.startsWith('ta');

  return (
    <>
      <header className="home-appbar">
        <div className="home-appbar-side">
          <button
            type="button"
            className="home-appbar-btn home-appbar-lang"
            onClick={() => setSavedLang(english ? 'ta' : 'en')}
            aria-label={english ? 'தமிழுக்கு மாற்று' : 'Switch to English'}
          >
            <span lang={english ? 'ta' : 'en'}>{english ? 'த' : 'EN'}</span>
          </button>
        </div>

        <div className="home-appbar-brand">
          <span className="home-appbar-logo">
            <Logo size={24} />
          </span>
          <span className="home-appbar-name">
            <strong>My People</strong>
            <small lang="ta">என் மக்கள்</small>
          </span>
        </div>

        <div className="home-appbar-side home-appbar-side--end">
          <Link
            to="/notifications"
            className="home-appbar-btn"
            aria-label={
              unread
                ? t('Notifications, some unread', 'அறிவிப்புகள், படிக்காதவை உள்ளன')
                : t('Notifications', 'அறிவிப்புகள்')
            }
          >
            <Bell size={18} strokeWidth={2.4} aria-hidden="true" />
            {unread && <span className="home-appbar-dot" aria-hidden="true" />}
          </Link>
          <Link
            to="/profile"
            className="home-appbar-btn home-appbar-avatar"
            aria-label={t('Your profile', 'உங்கள் சுயவிவரம்')}
          >
            <UserRound size={18} strokeWidth={2.4} aria-hidden="true" />
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
        </div>
      </header>

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
          <button type="button" onClick={() => onSearch('')} aria-label={t('Clear search', 'தேடலை அழி')}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}
