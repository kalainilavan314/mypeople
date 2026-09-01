import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius, shadow } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

type TabKey = 'home' | 'events' | 'card' | 'gallery' | 'profile';

interface Tab {
  key: TabKey;
  path: string;
  icon: IconName;
  // route prefixes that keep this tab active (stack screens grouped under it)
  match: string[];
}

const TABS: Tab[] = [
  { key: 'home', path: '/', icon: 'home', match: ['/', '/announcement', '/survey'] },
  { key: 'events', path: '/events', icon: 'calendar', match: ['/events'] },
  { key: 'card', path: '/card', icon: 'card', match: ['/card', '/milestones', '/referral'] },
  { key: 'gallery', path: '/gallery', icon: 'image', match: ['/gallery'] },
  { key: 'profile', path: '/profile', icon: 'user', match: ['/profile', '/courses', '/ideas', '/skills', '/privacy', '/notifications', '/language', '/reports', '/fund'] },
];

function isActive(tab: Tab, pathname: string): boolean {
  if (tab.key === 'home') return pathname === '/' || pathname.startsWith('/announcement') || pathname.startsWith('/survey');
  return tab.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
}

/**
 * Floating pill navigation (NorthNadu reference): a rounded white bar lifted off
 * the page edge, the active tab marked by a tinted chip behind its icon.
 *
 * Labels render once, in the active UI language only — the previous version
 * printed the i18n label and a hardcoded English label, which read as
 * "Home Home" whenever the UI was already in English (the default).
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav
      aria-label="Primary"
      style={{
        flex: 'none',
        background: 'transparent',
        padding: `4px 12px calc(10px + var(--safe-bottom))`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          background: c.card,
          border: `1px solid ${c.hairline}`,
          borderRadius: 28,
          boxShadow: shadow.nav,
          padding: '6px 6px',
        }}
      >
        {TABS.map((tab) => {
          const active = isActive(tab, pathname);
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0',
              }}
            >
              <span
                style={{
                  width: 44, height: 32, borderRadius: radius.md,
                  background: active ? c.maroonTint : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 200ms var(--ease)',
                }}
              >
                {/* No `fill` here: Icon drops the stroke entirely when fill is set,
                    which would render the active icon as a near-invisible solid
                    shape. The tinted chip behind it already marks active state. */}
                <Icon
                  name={tab.icon}
                  size={21}
                  color={active ? c.primary : c.ink3}
                  strokeWidth={active ? 2.2 : 1.9}
                />
              </span>
              <span
                style={{
                  font: `${active ? 700 : 500} 10.5px/1.1 ${font.ui}`,
                  color: active ? c.primary : c.ink3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
                }}
              >
                {t(`nav.${tab.key}`)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
