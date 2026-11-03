import type { WorkQueues } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { SystemStatus } from '@/components/SystemStatus';
import { builtModules, plannedModules } from '@/lib/modules';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

export default function DashboardHome() {
  return (
    <>
      <PageHeader ta="நிர்வாகம் மற்றும் பணி வரிசைகள்" en="Work queues & administration" />
      <p className="flex flex-col gap-1 rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning">
        <span lang="ta" className="font-semibold">
          ! வெளியீட்டுக்கு முந்தைய சூழல். பாதுகாப்பு கட்டுப்பாடுகள், தணிக்கை நீர்வரி மற்றும் உற்பத்தி உள்ளடக்கப் பாதுகாப்புக் கொள்கைகள் அனைத்துப் பணியாளர் தொகுதிகளிலும் செயலில் உள்ளன.
        </span>
        <span lang="en" className="text-xs opacity-90">
          Pre-release environment. Security controls, audit watermarking, and production content security policies remain active across all staff modules.
        </span>
      </p>

      <Suspense fallback={<p className="text-muted">… Loading your work queues</p>}>
        <PriorityWorkQueues />
      </Suspense>

      <Suspense fallback={<p className="text-muted">… Loading your modules</p>}>
        <MyModules />
      </Suspense>

      <section aria-labelledby="status-heading" className="flex flex-col gap-3">
        <h2 id="status-heading" className="flex flex-col text-base font-bold">
          <span lang="ta">கணினி நிலைமை</span>
          <span lang="en" className="text-xs font-normal text-muted">System status</span>
        </h2>
        <Suspense fallback={<p className="text-muted">… Checking</p>}>
          <SystemStatus />
        </Suspense>
      </section>

      <section aria-labelledby="planned-heading" className="flex flex-col gap-3">
        <h2 id="planned-heading" className="flex flex-col text-base font-bold">
          <span lang="ta">அடுத்தகட்ட தொகுதிகள் (கட்டம் 2 & 3)</span>
          <span lang="en" className="text-xs font-normal text-muted">Remaining modules (Phase 2 & 3)</span>
        </h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {plannedModules.map((module) => (
            <li key={module.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span lang="ta" className="block text-sm font-semibold text-text">
                  {module.ta}
                </span>
                <span lang="en" className="block text-xs font-normal text-muted">{module.name}</span>
                <span className="block text-xs text-muted">{module.desc}</span>
              </span>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">Phase 2 / 3</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** Operational action cards showing only queues the staff member is permitted to access. */
async function PriorityWorkQueues() {
  await requireStaff();
  let queues: WorkQueues | null = null;
  let unavailable = false;

  try {
    const api = await staffApi();
    queues = await api.getWorkQueues();
  } catch (error) {
    if (isRefusal(error)) unavailable = true;
    else throw error;
  }

  if (unavailable || !queues) {
    return (
      <section aria-labelledby="priority-heading" className="flex flex-col gap-3">
        <h2 id="priority-heading" className="flex flex-col text-base font-bold">
          <span lang="ta">முன்னுரிமைப் பணி வரிசைகள்</span>
          <span lang="en" className="text-xs font-normal text-muted">Priority work queues</span>
        </h2>
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          Operational work queue counts are unavailable or you do not have permission to view them.
        </p>
      </section>
    );
  }

  type QueueCard = {
    titleTa: string;
    titleEn: string;
    href: string;
    count: number;
    countLabel: string;
    subtext: string;
    urgent?: boolean;
    urgentNotice?: string;
  };

  const cards: QueueCard[] = [];

  if (queues.verification) {
    cards.push({
      titleTa: 'அடையாளச் சரிபார்ப்பு',
      titleEn: 'Identity reviews',
      href: '/verification',
      count: queues.verification.awaitingReview,
      countLabel: 'waiting for review',
      subtext: `${queues.verification.needsUpdate} with member · ${queues.verification.assignedToMe} claimed by you`,
      urgent: queues.verification.awaitingReview > 0,
    });
  }

  if (queues.appeals) {
    cards.push({
      titleTa: 'மேன்முறையீடுகள்',
      titleEn: 'Verification appeals',
      href: '/appeals',
      count: queues.appeals.waiting,
      countLabel: 'appeals waiting decision',
      subtext: 'Appeals submitted by members against adverse review decisions',
      urgent: queues.appeals.waiting > 0,
    });
  }

  if (queues.duplicates) {
    cards.push({
      titleTa: 'இரட்டைக் கணக்குகள்',
      titleEn: 'Duplicate investigations',
      href: '/duplicates',
      count: queues.duplicates.open,
      countLabel: 'open cases',
      subtext: 'Flagged potential duplicate member accounts requiring investigation',
      urgent: queues.duplicates.open > 0,
    });
  }

  if (queues.membership) {
    cards.push({
      titleTa: 'உறுப்புரிமை அனுமதி',
      titleEn: 'Membership activation',
      href: '/membership',
      count: queues.membership.awaitingActivation,
      countLabel: 'verified members awaiting activation',
      subtext: 'Confirmed identity members pending membership approval in your area',
      urgent: queues.membership.awaitingActivation > 0,
    });
  }

  if (queues.galleryRemovals) {
    cards.push({
      titleTa: 'புகைப்பட நீக்கக் கோரிக்கைகள்',
      titleEn: 'Photo removal requests',
      href: '/gallery?tab=removals',
      count: queues.galleryRemovals.open,
      countLabel: 'open removal requests',
      subtext: '24-hour statutory removal requests from members and the public',
      urgent: queues.galleryRemovals.escalated18H > 0 || queues.galleryRemovals.open > 0,
      urgentNotice:
        queues.galleryRemovals.escalated18H > 0
          ? `${queues.galleryRemovals.escalated18H} requests open 18+ hours (escalated to Tier 5)`
          : undefined,
    });
  }

  if (queues.galleryAlbums) {
    cards.push({
      titleTa: 'புகைப்படத் தொகுப்புகள்',
      titleEn: 'Gallery albums',
      href: '/gallery?tab=albums',
      count: queues.galleryAlbums.submitted,
      countLabel: 'albums submitted for review',
      subtext: `${queues.galleryAlbums.drafts} drafts in preparation`,
      urgent: queues.galleryAlbums.submitted > 0,
    });
  }

  if (queues.events) {
    cards.push({
      titleTa: 'நிகழ்வுகள் மேலாண்மை',
      titleEn: 'Event console',
      href: '/events',
      count: queues.events.drafts,
      countLabel: 'draft events needing action',
      subtext: `${queues.events.published} published events · ${queues.events.total} total managed`,
      urgent: queues.events.drafts > 0,
    });
  }

  if (queues.messaging) {
    cards.push({
      titleTa: 'அறிவித்தல்கள் & செய்திகள்',
      titleEn: 'Broadcasts & messaging',
      href: '/messages',
      count: queues.messaging.pendingApproval,
      countLabel: 'broadcasts pending approval',
      subtext: `${queues.messaging.drafts} drafts in progress`,
      urgent: queues.messaging.pendingApproval > 0,
    });
  }

  if (queues.configuration) {
    cards.push({
      titleTa: 'கணினி அமைப்புகள்',
      titleEn: 'Feature flags & settings',
      href: '/settings',
      count: queues.configuration.enabled,
      countLabel: `of ${queues.configuration.total} feature modules active`,
      subtext: 'Phase gates and module switches for v1.1 architecture',
    });
  }

  if (cards.length === 0) {
    return (
      <section aria-labelledby="priority-heading" className="flex flex-col gap-3">
        <h2 id="priority-heading" className="text-base font-bold">
          Priority work queues
        </h2>
        {queues.unavailable && queues.unavailable.length > 0 ? (
          <p className="rounded-xl border border-warning bg-warning-bg p-4 text-sm text-warning">
            ! Some work queue counts could not be retrieved ({queues.unavailable.join(', ')}).
          </p>
        ) : (
          <p className="rounded-xl border border-line bg-card p-4 text-sm text-muted">
            Your active staff roles do not grant access to operational work queues.
          </p>
        )}
      </section>
    );
  }

  const totalUrgent = cards.reduce((sum, c) => sum + (c.urgent ? c.count : 0), 0);

  return (
    <section aria-labelledby="priority-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="priority-heading" className="flex flex-col text-base font-bold">
          <span lang="ta">முன்னுரிமைப் பணி வரிசைகள்</span>
          <span lang="en" className="text-xs font-normal text-muted">Priority work queues</span>
        </h2>
        <span className="text-xs text-muted">
          {totalUrgent > 0 ? `${totalUrgent} items requiring staff action` : 'All assigned queues clear'}
        </span>
      </div>

      {queues.unavailable && queues.unavailable.length > 0 ? (
        <p className="rounded-xl border border-warning/50 bg-warning-bg p-3 text-xs text-warning">
          ! Some work queues could not be retrieved and are temporarily unavailable ({queues.unavailable.join(', ')}).
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition-colors hover:bg-surface ${
              card.urgent && card.count > 0 ? 'border-warning/60 bg-warning-bg/20' : 'border-line bg-card'
            }`}>
            <div className="flex flex-col gap-0.5">
              <span lang="ta" className="font-semibold text-text">
                {card.titleTa}
              </span>
              <span lang="en" className="text-xs font-normal text-muted">
                {card.titleEn}
              </span>
              {card.urgentNotice ? (
                <p className="mt-1 rounded bg-error-bg px-2 py-0.5 text-xs font-semibold text-error">
                  ! {card.urgentNotice}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{card.count}</span>
                <span className="text-xs text-muted">{card.countLabel}</span>
              </div>
              <p className="text-xs text-muted">{card.subtext}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The staff member's permitted navigation modules. */
async function MyModules() {
  const staff = await requireStaff();
  const allowed = builtModules.filter((module) =>
    Array.isArray(module.permission)
      ? module.permission.some((p) => staff.permissions.has(p))
      : staff.permissions.has(module.permission as string),
  );

  return (
    <section aria-labelledby="modules-heading" className="flex flex-col gap-3">
      <h2 id="modules-heading" className="flex flex-col text-base font-bold">
        <span lang="ta">ஒதுக்கப்பட்ட அனைத்துத் தொகுதிகள்</span>
        <span lang="en" className="text-xs font-normal text-muted">All assigned modules</span>
      </h2>
      {allowed.length === 0 ? <p className="text-sm text-muted">Your role has no dashboard modules.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allowed.map((module) => (
          <li key={module.href}>
            <Link
              href={module.href}
              className="flex min-h-20 flex-col gap-0.5 rounded-xl border border-line bg-card p-4 hover:bg-surface">
              <span lang="ta" className="text-sm font-semibold text-text">
                {module.ta}
              </span>
              <span lang="en" className="text-xs font-normal text-muted">
                {module.en}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
