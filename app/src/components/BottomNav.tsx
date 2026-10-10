import { useLocation, useNavigate } from 'react-router-dom';
import { useLayoutEffect, useRef } from 'react';
import { Home, CalendarDays, ScanLine, Images, User, type LucideIcon } from 'lucide-react';
import { useWorkspaceText } from './MemberWorkspace';

// Five stable destinations from the member wireframes.
type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  match: string[];
  raised?: boolean;
};

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const t = useWorkspaceText();
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const shell = nav?.closest<HTMLElement>('.member-shell');
    if (!nav || !shell) return;
    const measure = () => {
      const bar = nav.getBoundingClientRect();
      const orb = nav.querySelector('.medtech-nav-orb')?.getBoundingClientRect();
      const rise = orb ? Math.max(0, bar.top - orb.top) : 0;
      shell.style.setProperty('--member-nav-clearance', `${Math.ceil(bar.height + rise + 26)}px`);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(nav);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const tabs: Tab[] = [
    { to: '/', label: t('Home', 'முகப்பு'), icon: Home, match: ['/', '/reports', '/community', '/area', '/fund', '/ideas', '/skills', '/courses', '/survey', '/announcement'] },
    { to: '/events', label: t('Events', 'நிகழ்வுகள்'), icon: CalendarDays, match: ['/events'] },
    { to: '/card', label: t('Card', 'அட்டை'), icon: ScanLine, match: ['/card', '/milestones'], raised: true },
    {
      to: '/gallery',
      label: t('Gallery', 'படங்கள்'),
      icon: Images,
      match: ['/gallery'],
    },
    {
      to: '/profile',
      label: t('Profile', 'சுயவிவரம்'),
      icon: User,
      match: ['/profile', '/referral', '/privacy', '/language', '/notifications'],
    },
  ];

  const isActive = (tab: Tab) =>
    tab.match.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')));

  return (
    <nav ref={navRef} className="work-nav medtech-nav" aria-label={t('Primary navigation', 'முக்கிய வழிசெலுத்தல்')}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        const IconComp = tab.icon;

        return (
          <button
            key={tab.to}
            type="button"
            className={tab.raised ? 'medtech-nav-center' : undefined}
            onClick={() => {
              navigate(tab.raised ? '/card?qr=1' : tab.to);
              document.querySelector<HTMLElement>('.screen')?.scrollTo({ top: 0 });
            }}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.raised ? t('Card and check-in QR', 'அட்டை மற்றும் வருகைப் பதிவு குறியீடு') : undefined}
          >
            <span className={tab.raised ? 'medtech-nav-orb' : 'work-nav-icon'}>
              <IconComp size={tab.raised ? 26 : 23} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
            </span>
            <span className={t('en', 'ta') === 'ta' ? 'ta' : undefined}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
