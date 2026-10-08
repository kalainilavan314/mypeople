import { useLocation, useNavigate } from 'react-router-dom';
import { Home, CalendarDays, Plus, Users, User, type LucideIcon } from 'lucide-react';
import { useWorkspaceText } from './MemberWorkspace';

// Primary navigation — Option B (Home | Events | Center Report FAB | Community | Profile)
type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  match: string[];
  isFab?: boolean;
};

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const t = useWorkspaceText();

  const tabs: Tab[] = [
    { to: '/', label: t('Home', 'முகப்பு'), icon: Home, match: ['/'] },
    {
      to: '/events',
      label: t('Events', 'நிகழ்வுகள்'),
      icon: CalendarDays,
      match: ['/events'],
    },
    {
      to: '/reports',
      label: t('Report', 'பதிவு'),
      icon: Plus,
      match: ['/reports'],
      isFab: true,
    },
    {
      to: '/community',
      label: t('Community', 'சமூகம்'),
      icon: Users,
      match: ['/community', '/area', '/fund', '/ideas', '/skills', '/courses', '/survey', '/gallery'],
    },
    {
      to: '/profile',
      label: t('Profile', 'சுயவிவரம்'),
      icon: User,
      match: ['/profile', '/card', '/milestones', '/referral', '/privacy', '/language', '/notifications'],
    },
  ];

  const isActive = (tab: Tab) =>
    tab.match.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')));

  return (
    <nav className="work-nav" aria-label={t('Primary navigation', 'முக்கிய வழிசெலுத்தல்')}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        const IconComp = tab.icon;

        if (tab.isFab) {
          return (
            <button
              key={tab.to}
              type="button"
              className="work-nav-fab-btn"
              onClick={() => navigate(tab.to)}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.label}
            >
              <span className="work-nav-fab">
                <IconComp size={25} color="#ffffff" strokeWidth={2.8} />
              </span>
              <span className={`work-nav-fab-label ${t('en', 'ta') === 'ta' ? 'ta' : ''}`}>{tab.label}</span>
            </button>
          );
        }

        return (
          <button
            key={tab.to}
            type="button"
            onClick={() => navigate(tab.to)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="work-nav-icon">
              <IconComp size={20} strokeWidth={active ? 2.4 : 1.8} />
            </span>
            <span className={t('en', 'ta') === 'ta' ? 'ta' : undefined}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
