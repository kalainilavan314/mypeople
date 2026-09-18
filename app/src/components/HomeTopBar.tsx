import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { useWorkspaceText } from './MemberWorkspace';

/**
 * Fixed top bar for the Home screen: a centred brand mark with a single icon
 * action on each side — Notifications on the left, Language on the right.
 * Sticky, so it stays put while Home scrolls.
 */
export function HomeTopBar() {
  const navigate = useNavigate();
  const t = useWorkspaceText();

  const iconBtn = (name: IconName, label: string, onClick: () => void) => (
    <button type="button" className="topbar-btn" onClick={onClick} aria-label={label}>
      <Icon name={name} size={20} />
    </button>
  );

  return (
    <header className="home-topbar">
      <div className="topbar-group">
        {iconBtn('bell', t('Notifications', 'அறிவிப்புகள்'), () => navigate('/notifications'))}
      </div>

      <button type="button" className="topbar-logo" onClick={() => navigate('/')} aria-label={t('My People home', 'என் மக்கள் முகப்பு')}>
        <Logo size={30} style={{ borderRadius: 8 }} />
        <span className="topbar-word">
          <span className="ta">என் மக்கள்</span>
          <span>My People</span>
        </span>
      </button>

      <div className="topbar-group">
        {iconBtn('globe', t('Language', 'மொழி'), () => navigate('/language'))}
      </div>
    </header>
  );
}
