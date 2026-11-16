import { Suspense } from 'react';

import { StaffSidebar } from '@/components/StaffSidebar';
import { getAdminLocale } from '@/lib/i18n';
import { builtModules } from '@/lib/modules';
import { requireStaff } from '@/lib/staff';

/** Every page here needs a staff session with the second factor given; the API checks it again on each call. */
export default function StaffLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-page md:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <StaffSidebarSection />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">{children}</div>
      </main>
    </div>
  );
}

async function StaffSidebarSection() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);

  const allowed = builtModules.filter((module) =>
    Array.isArray(module.permission)
      ? module.permission.some((p) => staff.permissions.has(p))
      : staff.permissions.has(module.permission as string),
  );

  return (
    <StaffSidebar
      staff={{
        fullName: staff.member.fullName,
        memberCode: staff.member.memberCode,
        assignments: staff.assignments.map((a) => ({
          id: a.id,
          tier: a.tier,
          area: { level: a.area.level, code: a.area.code },
        })),
      }}
      allowedModules={allowed.map((m) => ({
        href: m.href,
        ta: m.ta,
        en: m.en,
      }))}
      serverLocale={locale}
    />
  );
}

function SidebarSkeleton() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 self-start overflow-hidden border-r border-line bg-page p-6 md:flex md:flex-col">
      <div className="flex flex-col gap-3">
        <div className="h-6 w-36 animate-pulse rounded bg-surface" />
        <div className="h-8 w-24 animate-pulse rounded bg-surface" />
        <div className="h-20 w-full animate-pulse rounded-xl bg-surface" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
      </div>
    </aside>
  );
}
