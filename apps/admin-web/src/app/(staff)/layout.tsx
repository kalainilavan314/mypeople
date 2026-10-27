import Link from 'next/link';
import { Suspense } from 'react';

import { signOut } from '@/app/sign-in/actions';
import { builtModules } from '@/lib/modules';
import { requireStaff } from '@/lib/staff';

/** Every page here needs a staff session with the second factor given; the API checks it again on each call. */
export default function StaffLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
      <nav aria-label="Dashboard" className="flex flex-col gap-3 md:w-56 md:shrink-0">
        <Link href="/" className="flex flex-col">
          <span lang="ta" className="text-sm text-muted">
            என் மக்கள்
          </span>
          <span className="font-bold">My People · Administration</span>
        </Link>
        <Suspense fallback={<p className="text-sm text-muted">… Checking your session</p>}>
          <StaffMenu />
        </Suspense>
      </nav>
      <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}

async function StaffMenu() {
  const staff = await requireStaff();
  const allowed = builtModules.filter((module) => staff.permissions.has(module.permission));
  return (
    <>
      <div className="rounded-xl border border-line bg-card px-3 py-2 text-sm">
        <p className="font-semibold">{staff.member.fullName}</p>
        <p className="font-mono text-xs text-muted">{staff.member.memberCode}</p>
        {staff.assignments.map((assignment) => (
          <p key={assignment.id} className="text-xs text-muted">
            Tier {assignment.tier} · {assignment.area.level === 'platform' ? 'platform' : `${assignment.area.level} ${assignment.area.code}`}
          </p>
        ))}
      </div>
      <ul className="flex flex-col">
        {allowed.map((module) => (
          <li key={module.href}>
            <Link href={module.href} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold hover:bg-surface">
              {module.en}
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button type="submit" className="min-h-11 w-full rounded-lg border border-line px-3 text-left text-sm text-error hover:bg-error-bg">
          Sign out
        </button>
      </form>
    </>
  );
}
