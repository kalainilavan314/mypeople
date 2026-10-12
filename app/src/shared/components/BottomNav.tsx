import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { CalendarDays, Home, Images, ScanLine, User, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  match: string[];
  destination?: string;
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
      const icons = [...nav.querySelectorAll('.work-nav-icon')].map(
        (icon) => icon.getBoundingClientRect().top,
      );
      const top = Math.min(bar.top, ...icons);
      const clearance = shell.getBoundingClientRect().bottom - top + 16;
      shell.style.setProperty('--member-nav-clearance', `${Math.ceil(clearance)}px`);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(nav);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const tabs: Tab[] = [
    {
      to: '/',
      label: t('Home', 'முகப்பு'),
      icon: Home,
      match: [
        '/',
        '/reports',
        '/community',
        '/area',
        '/fund',
        '/ideas',
        '/skills',
        '/courses',
        '/survey',
        '/announcement',
      ],
    },
    { to: '/events', label: t('Events', 'நிகழ்வுகள்'), icon: CalendarDays, match: ['/events'] },
    {
      to: '/card',
      label: t('Card', 'அட்டை'),
      icon: ScanLine,
      match: ['/card', '/milestones'],
      destination: '/card?qr=1',
    },
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
    tab.match.some((p) =>
      p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/'),
    );

  return (
    <nav
      ref={navRef}
      className="work-nav medtech-nav"
      aria-label={t('Primary navigation', 'முக்கிய வழிசெலுத்தல்')}
    >
      {tabs.map((tab) => {
        const active = isActive(tab);
        const IconComp = tab.icon;

        return (
          <button
            key={tab.to}
            type="button"
            className={tab.destination ? 'medtech-nav-card' : undefined}
            onClick={() => {
              navigate(tab.destination ?? tab.to);
              document.querySelector<HTMLElement>('.screen')?.scrollTo({ top: 0 });
            }}
            aria-current={active ? 'page' : undefined}
            aria-label={
              tab.destination
                ? t('Card and check-in QR', 'அட்டை மற்றும் வருகைப் பதிவு குறியீடு')
                : undefined
            }
          >
            <span className="work-nav-icon">
              <IconComp size={23} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className={t('en', 'ta') === 'ta' ? 'ta' : undefined}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
