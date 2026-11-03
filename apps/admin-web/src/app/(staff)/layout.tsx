import { Suspense } from 'react';

import { StaffSidebar } from '@/components/StaffSidebar';
import { getAdminLocale } from '@/lib/i18n';
import { builtModules } from '@/lib/modules';
import { requireStaff } from '@/lib/staff';

/** Every page here needs a staff session with the second factor given; the API checks it again on each call. */
export default function StaffLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 md:flex-row md:py-6">
      <Suspense fallback={<SidebarSkeleton />}>
        <StaffSidebarSection />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
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
    <aside className="sticky top-6 hidden md:flex flex-col gap-4 w-60 shrink-0 self-start max-h-[calc(100vh-3rem)] overflow-hidden">
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
