import Link from 'next/link';
import { Suspense } from 'react';

import { signOut } from '@/app/sign-in/actions';
import { LanguageSelector } from '@/components/LanguageSelector';
import { StaffBrand } from '@/components/StaffBrand';
import { getAdminLocale, getTranslator } from '@/lib/i18n';
import { builtModules } from '@/lib/modules';
import { requireStaff } from '@/lib/staff';

/** Every page here needs a staff session with the second factor given; the API checks it again on each call. */
export default function StaffLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <nav aria-label="Staff navigation" className="flex flex-col gap-4 md:w-56 md:shrink-0">
        <div className="flex flex-col gap-2">
          <StaffBrand />
          <LanguageSelector className="self-start" />
        </div>
        <Suspense fallback={<p className="text-sm text-muted">… Checking session</p>}>
          <StaffMenu />
        </Suspense>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}

async function StaffMenu() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const t = getTranslator(locale);

  const allowed = builtModules.filter((module) =>
    Array.isArray(module.permission)
      ? module.permission.some((p) => staff.permissions.has(p))
      : staff.permissions.has(module.permission as string),
  );

  return (
    <>
      <div className="rounded-xl border border-line bg-card px-3 py-2 text-sm">
        <p className="font-semibold">{staff.member.fullName}</p>
        <p className="font-mono text-xs text-muted">{staff.member.memberCode}</p>
        {staff.assignments.map((assignment) => (
          <p key={assignment.id} className="text-xs text-muted">
            {locale === 'ta' ? 'நிலை' : 'Tier'} {assignment.tier} · {assignment.area.level === 'platform' ? 'platform' : `${assignment.area.level} ${assignment.area.code}`}
          </p>
        ))}
      </div>
      <ul className="flex flex-col gap-1">
        {allowed.map((module) => (
          <li key={module.href}>
            <Link
              href={module.href}
              className="flex min-h-11 items-center rounded-lg px-3 py-2 hover:bg-surface">
              <span lang={locale} className="text-sm font-medium text-text">
                {locale === 'ta' ? module.ta : module.en}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-11 w-full items-center rounded-lg border border-line px-3 py-2 text-left text-sm font-semibold text-error hover:bg-error-bg">
          <span lang={locale}>
            {t('nav.signOut')}
          </span>
        </button>
      </form>
    </>
  );
}
