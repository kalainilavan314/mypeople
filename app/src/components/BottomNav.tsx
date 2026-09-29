import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { useWorkspaceText } from './MemberWorkspace';

// Primary navigation — five destinations (Home / Events / Card / Gallery /
// Profile). Each tab owns a family of routes so deep pages keep a tab lit.
// Other destinations (Community hub, Reports, Skills, Fund, Referral…) are
// reached from within Home and Profile rather than a centre action button.
type Tab = { to: string; label: string; icon: IconName; match: string[] };

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const t = useWorkspaceText();

  const tabs: Tab[] = [
    { to: '/', label: t('Home', 'முகப்பு'), icon: 'home', match: ['/'] },
    {
      to: '/events',
      label: t('Events', 'நிகழ்வுகள்'),
      icon: 'calendar',
      match: ['/events'],
    },
    { to: '/card', label: t('Card', 'அட்டை'), icon: 'idCard', match: ['/card', '/milestones'] },
    {
      to: '/community',
      label: t('Community', 'சமூகம்'),
      icon: 'users',
      // Community is the hub for local participation destinations.
      match: ['/community', '/area', '/reports', '/fund', '/ideas', '/skills', '/courses', '/survey', '/gallery'],
    },
    {
      to: '/profile',
      label: t('Profile', 'சுயவிவரம்'),
      icon: 'user',
      // Profile owns the member's own identity and settings.
      match: ['/profile', '/referral', '/privacy', '/language', '/notifications'],
    },
  ];

  const isActive = (tab: Tab) =>
    tab.match.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')));

  return (
    <nav className="work-nav" aria-label={t('Primary navigation', 'முக்கிய வழிசெலுத்தல்')}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.to}
            type="button"
            onClick={() => navigate(tab.to)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="work-nav-icon">
              <Icon name={tab.icon} size={24} />
            </span>
            <span className={t('en', 'ta') === 'ta' ? 'ta' : undefined}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
