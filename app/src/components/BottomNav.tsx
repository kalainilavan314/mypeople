import { useLocation, useNavigate } from 'react-router-dom';
import { Home, CalendarDays, IdCard, Image as ImageIcon, User, type LucideIcon } from 'lucide-react';
import { useWorkspaceText } from './MemberWorkspace';

// Primary navigation — the five stable destinations from the spec:
// Home · Events · Card · Gallery · Profile. Card is the centre tab but a normal
// tab, not an oversized floating control. Secondary features (Report, Community
// hub, surveys, fund, …) live inside these tabs, not in the bar.
type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  match: string[];
};

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const t = useWorkspaceText();

  const tabs: Tab[] = [
    {
      to: '/',
      label: t('Home', 'முகப்பு'),
      icon: Home,
      // Home is the next-action desk; the community hub and its task screens are
      // reached from here, so they keep Home highlighted.
      match: ['/', '/community', '/area', '/reports', '/fund', '/ideas', '/skills', '/courses', '/survey', '/announcement'],
    },
    {
      to: '/events',
      label: t('Events', 'நிகழ்வுகள்'),
      icon: CalendarDays,
      match: ['/events'],
    },
    {
      to: '/card',
      label: t('Card', 'அட்டை'),
      icon: IdCard,
      match: ['/card', '/milestones'],
    },
    {
      to: '/gallery',
      label: t('Gallery', 'தொகுப்பு'),
      icon: ImageIcon,
      match: ['/gallery'],
    },
    {
      to: '/profile',
      label: t('Profile', 'சுயவிவரம்'),
      icon: User,
      match: ['/profile', '/privacy', '/language', '/notifications', '/referral'],
    },
  ];

  const isActive = (tab: Tab) =>
    tab.match.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')));

  return (
    <nav className="work-nav" aria-label={t('Primary navigation', 'முக்கிய வழிசெலுத்தல்')}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        const IconComp = tab.icon;
        return (
          <button
            key={tab.to}
            type="button"
            onClick={() => navigate(tab.to)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="work-nav-icon">
              <IconComp size={24} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
            </span>
            <span className={t('en', 'ta') === 'ta' ? 'ta' : undefined}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
