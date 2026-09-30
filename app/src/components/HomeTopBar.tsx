import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { useWorkspaceText } from './MemberWorkspace';

/**
 * Fixed top bar for the Home screen: the brand mark and name on the LEFT,
 * notification + language actions on the RIGHT. Sticky, so it stays put while
 * Home scrolls.
 */
export function HomeTopBar() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useWorkspaceText();

  return (
    <header className="home-topbar">
      <button type="button" className="topbar-logo" onClick={() => navigate('/')} aria-label={t('My People home', 'என் மக்கள் முகப்பு')}>
        <Logo size={34} style={{ borderRadius: 9 }} />
        <span className="topbar-word">
          <span className="ta">என் மக்கள்</span>
          <span>My People</span>
        </span>
      </button>

      <div className="topbar-group">
        <button type="button" className="topbar-btn" onClick={() => navigate('/notifications')} aria-label={t('Notifications', 'அறிவிப்புகள்')}>
          <Icon name="bell" size={20} />
          <span className="topbar-dot" aria-hidden="true" />
        </button>
        <button type="button" className="topbar-lang" onClick={() => navigate('/language')} aria-label={t('Language', 'மொழி')}>
          <Icon name="globe" size={17} />
          <span>{i18n.language === 'ta' ? 'த' : 'EN'}</span>
        </button>
      </div>
    </header>
  );
}
