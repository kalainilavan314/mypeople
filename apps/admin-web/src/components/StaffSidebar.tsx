'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { signOut } from '@/app/sign-in/actions';
import { StaffBrand } from '@/components/StaffBrand';
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
    }>;
  };
  allowedModules: Array<{
    href: string;
    ta: string;
    en: string;
  }>;
  serverLocale?: Locale;
};

// Clean, semantic SVGs with currentColor for theme integration
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function VerificationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function AppealsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

function DuplicatesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MembershipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
    </svg>
  );
}

function EventsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function GalleryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function AccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function AuditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function AccessReviewsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

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

function getModuleIcon(href: string) {
  switch (href) {
    case '/verification':
      return VerificationIcon;
    case '/appeals':
      return AppealsIcon;
    case '/duplicates':
      return DuplicatesIcon;
    case '/membership':
      return MembershipIcon;
    case '/events':
      return EventsIcon;
    case '/gallery':
      return GalleryIcon;
    case '/messages':
      return MessagesIcon;
    case '/settings':
      return SettingsIcon;
    case '/access':
      return AccessIcon;
    case '/audit':
      return AuditIcon;
    case '/access-reviews':
      return AccessReviewsIcon;
    default:
      return HomeIcon;
  }
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
      <div className="sticky top-0 z-30 -mx-4 -mt-4 mb-4 flex min-h-14 items-center justify-between border-b border-line bg-page px-4 py-2 md:hidden">
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
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-5 border-r border-line bg-page p-5 shadow-lg overflow-y-auto md:hidden">
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

            <div className="border-y border-line py-3 text-sm">
              <p className="font-semibold text-text">{staff.fullName}</p>
              <p className="font-mono text-xs text-muted">{staff.memberCode}</p>
              {staff.assignments.map((assignment) => (
                <p key={assignment.id} className="text-xs text-muted">
                  {locale === 'ta' ? 'நிலை' : 'Tier'} {assignment.tier} · {assignment.area.level === 'platform' ? 'platform' : `${assignment.area.level} ${assignment.area.code}`}
                </p>
              ))}
            </div>

            <ul className="flex flex-col gap-1">
              <li>
                <Link
                  href="/"
                  onClick={() => setIsMobileOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    pathname === '/'
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-text hover:bg-surface'
                  }`}>
                  <HomeIcon className="h-5 w-5 shrink-0" />
                  <span lang={locale} className="text-sm font-medium">
                    {locale === 'ta' ? 'முகப்பலகை' : 'Dashboard'}
                  </span>
                </Link>
              </li>
              {allowedModules.map((module) => {
                const isActive = pathname === module.href || pathname.startsWith(module.href + '/');
                const Icon = getModuleIcon(module.href);
                return (
                  <li key={module.href}>
                    <Link
                      href={module.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text hover:bg-surface'
                      }`}>
                      <Icon className="h-5 w-5 shrink-0" />
                      <span lang={locale} className="text-sm font-medium">
                        {locale === 'ta' ? module.ta : module.en}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto border-t border-line pt-4">
              <SignOutControl />
            </div>
          </div>
        </>
      )}

      {/* Desktop Fixed & Collapsible Sidebar (md: and above) */}
      <aside
        aria-label="Staff navigation"
        className={`hidden md:flex h-screen flex-col gap-5 sticky top-0 self-start overflow-y-auto overscroll-contain border-r border-line bg-page px-4 py-6 transition-[width] duration-200 ease-in-out shrink-0 ${
          isCollapsed ? 'w-20 items-center' : 'w-60'
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
              title={locale === 'ta' ? 'என் மக்கள் · முகப்பலகை' : 'My People · Dashboard'}
              aria-label="Dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors">
              MP
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
            <div className="border-y border-line py-3 text-sm">
              <p className="font-semibold text-text truncate">{staff.fullName}</p>
              <p className="font-mono text-xs text-muted truncate">{staff.memberCode}</p>
              {staff.assignments.map((assignment) => (
                <p key={assignment.id} className="text-xs text-muted truncate">
                  {locale === 'ta' ? 'நிலை' : 'Tier'} {assignment.tier} · {assignment.area.level === 'platform' ? 'platform' : `${assignment.area.level} ${assignment.area.code}`}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Modules List */}
        <nav aria-label="Modules navigation" className="w-full">
          <ul className={`flex flex-col gap-1 w-full ${isCollapsed ? 'items-center' : ''}`}>
            {/* Dashboard Home Link */}
            <li className="w-full">
              {isCollapsed ? (
                <Link
                  href="/"
                  title={locale === 'ta' ? 'முகப்பலகை' : 'Dashboard'}
                  aria-label={locale === 'ta' ? 'முகப்பலகை' : 'Dashboard'}
                  className={`mx-auto flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                    pathname === '/'
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:bg-surface hover:text-text'
                  }`}>
                  <HomeIcon className="h-5 w-5 shrink-0" />
                </Link>
              ) : (
                <Link
                  href="/"
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                    pathname === '/'
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-text hover:bg-surface'
                  }`}>
                  <HomeIcon className="h-5 w-5 shrink-0" />
                  <span lang={locale} className="text-sm font-medium">
                    {locale === 'ta' ? 'முகப்பலகை' : 'Dashboard'}
                  </span>
                </Link>
              )}
            </li>

            {allowedModules.map((module) => {
              const isActive = pathname === module.href || pathname.startsWith(module.href + '/');
              const Icon = getModuleIcon(module.href);
              const label = locale === 'ta' ? module.ta : module.en;

              return (
                <li key={module.href} className="w-full">
                  {isCollapsed ? (
                    <Link
                      href={module.href}
                      title={label}
                      aria-label={label}
                      className={`mx-auto flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                        isActive
                        ? 'bg-primary/10 text-primary'
                          : 'text-muted hover:bg-surface hover:text-text'
                      }`}>
                      <Icon className="h-5 w-5 shrink-0" />
                    </Link>
                  ) : (
                    <Link
                      href={module.href}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                        isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text hover:bg-surface'
                      }`}>
                      <Icon className="h-5 w-5 shrink-0" />
                      <span lang={locale} className="text-sm font-medium truncate">
                        {label}
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sign Out Action */}
        <div className="mt-auto w-full pt-3">
          <SignOutControl collapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
}
