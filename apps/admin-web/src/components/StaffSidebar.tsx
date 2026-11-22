'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { signOut } from '@/app/sign-in/actions';
import { StaffBrand } from '@/components/StaffBrand';
import { getModuleIcon, HomeIcon } from '@/components/ModuleIcons';
import { useLocale } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';

export type StaffSidebarProps = {
  staff: {
    fullName: string;
    memberCode: string;
    assignments: Array<{
      id: string;
      tier: string | number;
      area: { level: string; code?: string | null };
      /** The area's name in each language, so switching language here needs no new request. */
      areaName: { ta: string; en: string };
    }>;
  };
  allowedModules: Array<{
    href: string;
    ta: string;
    en: string;
  }>;
  serverLocale?: Locale;
};

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function SignOutControl({ collapsed }: { collapsed?: boolean }) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isConfirming) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsConfirming(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isConfirming]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        title={collapsed ? 'Sign out' : undefined}
        aria-label={collapsed ? 'Sign out' : undefined}
        className={collapsed
          ? 'mx-auto flex h-11 w-11 items-center justify-center rounded-lg text-error transition-colors hover:bg-error-bg focus:outline-none focus:ring-2 focus:ring-error'
          : 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-error transition-colors hover:bg-error-bg focus:outline-none focus:ring-2 focus:ring-error'}>
        <SignOutIcon className="h-5 w-5 shrink-0" />
        {!collapsed ? <span>Sign out</span> : null}
      </button>

      {isConfirming ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sign-out-title"
            aria-describedby="sign-out-description"
            className="w-full max-w-sm rounded-lg border border-line bg-card p-6 shadow-lg">
            <div className="flex flex-col gap-3">
              <h2 id="sign-out-title" className="text-lg font-semibold text-text">Sign out?</h2>
              <p id="sign-out-description" className="text-sm leading-6 text-muted">
                This ends your active staff sessions. You will need your password and authenticator code to sign in again.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="min-h-11 rounded-lg border border-line px-4 text-sm font-medium text-text transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary">
                Stay signed in
              </button>
              <form action={signOut}>
                <button type="submit" className="min-h-11 rounded-lg bg-error px-4 text-sm font-semibold text-on-primary focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type NavGroupKey = 'members' | 'community' | 'content' | 'admin';

/** Sidebar sections, so a long list of modules reads as a few clear areas of work. */
const NAV_GROUPS: readonly { key: NavGroupKey; ta: string; en: string; accent: string; hrefs: readonly string[] }[] = [
  {
    key: 'members',
    ta: 'உறுப்பினர்கள்',
    en: 'Members',
    accent: 'text-accent-indigo',
    hrefs: ['/verification', '/appeals', '/duplicates', '/membership', '/renewals', '/members', '/access', '/access-reviews'],
  },
  {
    key: 'community',
    ta: 'சமூகம்',
    en: 'Community',
    accent: 'text-accent-green',
    hrefs: [
      '/cases',
      '/support',
      '/volunteering',
      '/volunteer-assignments',
      '/development',
      '/surveys',
      '/learning',
      '/promises',
      '/scorecards',
      '/town-halls',
      '/budgeting',
      '/committees',
      '/livelihood',
      '/representatives',
      '/disaster',
      '/blood-requests',
      '/field',
      '/roster',
    ],
  },
  {
    key: 'content',
    ta: 'உள்ளடக்கம் & செய்திகள்',
    en: 'Content & messages',
    accent: 'text-accent-purple',
    hrefs: ['/events', '/gallery', '/messages', '/publishing', '/moderation', '/elections', '/assistant', '/ai-models'],
  },
  {
    key: 'admin',
    ta: 'நிதி & நிர்வாகம்',
    en: 'Finance & administration',
    accent: 'text-accent-orange',
    hrefs: [
      '/finance',
      '/finance-readiness',
      '/policy-decisions',
      '/privacy',
      '/audit',
      '/analytics',
      '/reports',
      '/settings',
      '/operations-governance',
    ],
  },
];

type NavModule = StaffSidebarProps['allowedModules'][number];

/** The allowed modules in their sections, keeping each section's order; anything unlisted joins the last. */
function groupModules(modules: readonly NavModule[]) {
  const groups = NAV_GROUPS.map((group) => ({ ...group, modules: [] as NavModule[] }));
  for (const item of modules) {
    const group = groups.find((g) => g.hrefs.includes(item.href)) ?? groups[groups.length - 1];
    group.modules.push(item);
  }
  for (const group of groups) group.modules.sort((a, b) => group.hrefs.indexOf(a.href) - group.hrefs.indexOf(b.href));
  return groups.filter((group) => group.modules.length > 0);
}

function NavLink({
  href,
  label,
  Icon,
  active,
  collapsed,
  accent,
  locale,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
  active: boolean;
  collapsed: boolean;
  accent: string;
  locale: Locale;
  onNavigate?: () => void;
}) {
  if (collapsed) {
    return (
      <Link
        href={href}
        title={label}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
        className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          active ? 'bg-primary text-on-primary shadow-card' : `${accent} hover:bg-surface`
        }`}>
        <Icon className="h-5 w-5 shrink-0" />
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        active ? 'bg-primary font-semibold text-on-primary shadow-card' : 'text-text-secondary hover:bg-surface hover:text-text'
      }`}>
      <Icon className={`h-5 w-5 shrink-0 ${active ? '' : accent}`} />
      <span lang={locale} className="text-sm font-medium leading-snug">
        {label}
      </span>
    </Link>
  );
}

/** Dashboard home and the allowed modules, in sections; used by the desktop sidebar and the mobile drawer. */
function NavList({
  modules,
  pathname,
  locale,
  collapsed,
  onNavigate,
}: {
  modules: readonly NavModule[];
  pathname: string;
  locale: Locale;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const home = locale === 'ta' ? 'முகப்பலகை' : 'Dashboard';
  return (
    <div className={`flex w-full flex-col gap-4 ${collapsed ? 'items-center' : ''}`}>
      <NavLink
        href="/"
        label={home}
        Icon={HomeIcon}
        active={pathname === '/'}
        collapsed={collapsed}
        accent="text-primary"
        locale={locale}
        onNavigate={onNavigate}
      />
      {groupModules(modules).map((group) => (
        <div key={group.key} className="flex w-full flex-col gap-1">
          {collapsed ? (
            <div className="mx-auto my-1 h-px w-8 bg-line" aria-hidden="true" />
          ) : (
            <p lang={locale} className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              {locale === 'ta' ? group.ta : group.en}
            </p>
          )}
          <ul className={`flex w-full flex-col gap-1 ${collapsed ? 'items-center' : ''}`}>
            {group.modules.map((module) => (
              <li key={module.href} className="w-full">
                <NavLink
                  href={module.href}
                  label={locale === 'ta' ? module.ta : module.en}
                  Icon={getModuleIcon(module.href)}
                  active={pathname === module.href || pathname.startsWith(module.href + '/')}
                  collapsed={collapsed}
                  accent={group.accent}
                  locale={locale}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The signed-in person: initial in a brand circle, name, member ID and each role. */
function StaffCard({ staff, locale }: { staff: StaffSidebarProps['staff']; locale: Locale }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface p-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-gold text-sm font-bold text-on-primary">
        {staff.fullName.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold leading-snug text-text">{staff.fullName}</p>
        <p className="font-mono text-xs text-muted">{staff.memberCode}</p>
        {staff.assignments.map((assignment) => (
          <p
            key={assignment.id}
            className="mt-1 inline-flex rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
            {locale === 'ta' ? 'நிலை' : 'Tier'} {assignment.tier} ·&nbsp;<span lang={locale}>{assignment.areaName[locale]}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

const SIDEBAR_STORAGE_KEY = 'admin_sidebar_collapsed';

function subscribeSidebarStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('admin-sidebar-toggle', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('admin-sidebar-toggle', callback);
  };
}

function getSidebarSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

export function StaffSidebar({ staff, allowedModules, serverLocale }: StaffSidebarProps) {
  const clientLocale = useLocale();
  const locale = serverLocale ?? clientLocale;
  const pathname = usePathname();

  const isCollapsed = useSyncExternalStore(
    subscribeSidebarStorage,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );

  const [prevPathname, setPrevPathname] = useState(pathname);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Sync mobile drawer state when pathname changes during render
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileOpen(false);
  }

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // Ignore
    }
    window.dispatchEvent(new Event('admin-sidebar-toggle'));
  };

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const collapseLabel = isCollapsed
    ? locale === 'ta'
      ? 'வழிசெலுத்தலை விரிவாக்குக'
      : 'Expand navigation'
    : locale === 'ta'
      ? 'வழிசெலுத்தலைச் சுருக்குக'
      : 'Collapse navigation';

  return (
    <>
      {/* Mobile Top Bar (< md) */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex min-h-14 items-center justify-between border-b border-line bg-card px-4 py-2 shadow-card md:hidden">
        <StaffBrand />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-expanded={isMobileOpen}
            aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-card text-text hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary">
            {isMobileOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay & Panel (< md) */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Staff navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-5 bg-card p-5 shadow-raised overflow-y-auto md:hidden">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <StaffBrand />
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <StaffCard staff={staff} locale={locale} />

            <nav aria-label="Modules navigation">
              <NavList
                modules={allowedModules}
                pathname={pathname}
                locale={locale}
                collapsed={false}
                onNavigate={() => setIsMobileOpen(false)}
              />
            </nav>

            <div className="mt-auto border-t border-line pt-4">
              <SignOutControl />
            </div>
          </div>
        </>
      )}

      {/* Desktop Fixed & Collapsible Sidebar (md: and above) */}
      <aside
        aria-label="Staff navigation"
        className={`hidden md:flex h-screen flex-col gap-5 sticky top-0 self-start overflow-y-auto overscroll-contain bg-card px-4 py-6 shadow-card transition-[width] duration-200 ease-in-out shrink-0 ${
          isCollapsed ? 'w-20 items-center' : 'w-64'
        }`}>
        {/* Top Header Row with Brand & Collapse Toggle */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <button
              type="button"
              onClick={handleToggleCollapse}
              aria-expanded={false}
              aria-label={collapseLabel}
              title={collapseLabel}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
            <Link
              href="/"
              title={locale === 'ta' ? 'தாயக மக்கள் கழகம் · முகப்பலகை' : 'TMK · Dashboard'}
              aria-label="Dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-surface transition-colors">
              <Image src="/icon.png" alt="" width={32} height={32} />
            </Link>
            <div
              title={`${staff.fullName} · ${staff.memberCode}`}
              aria-label={`${staff.fullName} (${staff.memberCode})`}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-xs font-semibold text-text cursor-default">
              {staff.fullName.charAt(0).toUpperCase()}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <StaffBrand />
              <button
                type="button"
                onClick={handleToggleCollapse}
                aria-expanded={true}
                aria-label={collapseLabel}
                title={collapseLabel}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <StaffCard staff={staff} locale={locale} />
          </div>
        )}

        {/* Navigation, in sections */}
        <nav aria-label="Modules navigation" className="w-full">
          <NavList modules={allowedModules} pathname={pathname} locale={locale} collapsed={isCollapsed} />
        </nav>

        {/* Sign Out Action */}
        <div className="mt-auto w-full pt-3">
          <SignOutControl collapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
}
