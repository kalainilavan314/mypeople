import type { WorkQueues } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { SystemStatus } from '@/components/SystemStatus';
import { getAdminLocale } from '@/lib/i18n';
import { builtModules, plannedModules } from '@/lib/modules';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

export default function DashboardHome() {
  return (
    <>
      <PageHeader ta="நிர்வாகம் மற்றும் பணி வரிசைகள்" en="Work queues & administration" />

      <Suspense fallback={null}>
        <DashboardNotice />
      </Suspense>

      <Suspense fallback={<ConsoleLoading rows={3} />}>
        <PriorityWorkQueues />
      </Suspense>

      <Suspense fallback={<ConsoleLoading rows={3} />}>
        <MyModules />
      </Suspense>

      <Suspense fallback={<p className="text-muted">… Loading status</p>}>
        <StatusSection />
      </Suspense>

      <Suspense fallback={<p className="text-muted">… Loading</p>}>
        <PlannedModulesSection />
      </Suspense>
    </>
  );
}

async function DashboardNotice() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);

  return (
    <p className="flex flex-col gap-1 rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning">
      <span lang={locale} className="font-semibold">
        {locale === 'ta'
          ? '! வெளியீட்டுக்கு முந்தைய சூழல். பாதுகாப்பு கட்டுப்பாடுகள், தணிக்கை நீர்வரி மற்றும் உற்பத்தி உள்ளடக்கப் பாதுகாப்புக் கொள்கைகள் அனைத்துப் பணியாளர் தொகுதிகளிலும் செயலில் உள்ளன.'
          : 'Pre-release environment. Security controls, audit watermarking, and production content security policies remain active across all staff modules.'}
      </span>
    </p>
  );
}

async function StatusSection() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);

  return (
    <section aria-labelledby="status-heading" className="flex flex-col gap-3">
      <h2 id="status-heading" className="text-base font-bold text-text">
        <span lang={locale}>{locale === 'ta' ? 'கணினி நிலைமை' : 'System status'}</span>
      </h2>
      <SystemStatus locale={locale} />
    </section>
  );
}

async function PlannedModulesSection() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);

  return (
    <section aria-labelledby="planned-heading" className="flex flex-col gap-3">
      <h2 id="planned-heading" className="text-base font-bold text-text">
        <span lang={locale}>{locale === 'ta' ? 'அடுத்தகட்ட தொகுதிகள் (கட்டம் 2 & 3)' : 'Remaining modules (Phase 2 & 3)'}</span>
      </h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {plannedModules.map((module) => (
          <li key={module.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span>
              <span lang={locale} className="block text-sm font-semibold text-text">
                {locale === 'ta' ? module.ta : module.name}
              </span>
              <span className="block text-xs text-muted">{module.desc}</span>
            </span>
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">Phase 2 / 3</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Operational action cards showing only queues the staff member is permitted to access. */
async function PriorityWorkQueues() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
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
        <h2 id="priority-heading" className="text-base font-bold text-text">
          <span lang={locale}>{locale === 'ta' ? 'முன்னுரிமைப் பணி வரிசைகள்' : 'Priority work queues'}</span>
        </h2>
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          {locale === 'ta'
            ? 'செயல்பாட்டுப் பணி வரிசை எண்ணிக்கைகள் கிடைக்கவில்லை அல்லது அதைப் பார்க்க உங்களுக்கு அனுமதி இல்லை.'
            : 'Operational work queue counts are unavailable or you do not have permission to view them.'}
        </p>
      </section>
    );
  }

  type QueueCard = {
    title: string;
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
      title: locale === 'ta' ? 'அடையாளச் சரிபார்ப்பு' : 'Identity reviews',
      href: '/verification',
      count: queues.verification.awaitingReview,
      countLabel: locale === 'ta' ? 'சரிபார்ப்புக்குக் காத்திருப்பவை' : 'waiting for review',
      subtext:
        locale === 'ta'
          ? `${queues.verification.needsUpdate} உறுப்பினரிடம் · ${queues.verification.assignedToMe} நீங்கள் பொறுப்பேற்றவை`
          : `${queues.verification.needsUpdate} with member · ${queues.verification.assignedToMe} claimed by you`,
      urgent: queues.verification.awaitingReview > 0,
    });
  }

  if (queues.appeals) {
    cards.push({
      title: locale === 'ta' ? 'மேன்முறையீடுகள்' : 'Verification appeals',
      href: '/appeals',
      count: queues.appeals.waiting,
      countLabel: locale === 'ta' ? 'தீர்மானத்திற்குக் காத்திருப்பவை' : 'appeals waiting decision',
      subtext:
        locale === 'ta'
          ? 'மறுப்பு முடிவுகளுக்கு எதிராக உறுப்பினர்கள் சமர்ப்பித்த மேன்முறையீடுகள்'
          : 'Appeals submitted by members against adverse review decisions',
      urgent: queues.appeals.waiting > 0,
    });
  }

  if (queues.duplicates) {
    cards.push({
      title: locale === 'ta' ? 'இரட்டைக் கணக்குகள்' : 'Duplicate investigations',
      href: '/duplicates',
      count: queues.duplicates.open,
      countLabel: locale === 'ta' ? 'திறந்த வழக்குகள்' : 'open cases',
      subtext:
        locale === 'ta'
          ? 'விசாரணை தேவைப்படும் சந்தேகத்திற்குரிய இரட்டைக் கணக்குகள்'
          : 'Flagged potential duplicate member accounts requiring investigation',
      urgent: queues.duplicates.open > 0,
    });
  }

  if (queues.membership) {
    cards.push({
      title: locale === 'ta' ? 'உறுப்புரிமை அனுமதி' : 'Membership activation',
      href: '/membership',
      count: queues.membership.awaitingActivation,
      countLabel: locale === 'ta' ? 'செயற்படுத்தலுக்குக் காத்திருக்கும் உறுப்பினர்கள்' : 'verified members awaiting activation',
      subtext:
        locale === 'ta'
          ? 'உங்கள் பகுதியில் உறுப்புரிமை அனுமதிக்காகக் காத்திருக்கும் சரிபார்க்கப்பட்ட உறுப்பினர்கள்'
          : 'Confirmed identity members pending membership approval in your area',
      urgent: queues.membership.awaitingActivation > 0,
    });
  }

  if (queues.galleryRemovals) {
    cards.push({
      title: locale === 'ta' ? 'புகைப்பட நீக்கக் கோரிக்கைகள்' : 'Photo removal requests',
      href: '/gallery?tab=removals',
      count: queues.galleryRemovals.open,
      countLabel: locale === 'ta' ? 'திறந்த கோரிக்கைகள்' : 'open removal requests',
      subtext:
        locale === 'ta'
          ? 'உறுப்பினர்கள் மற்றும் பொதுமக்களிடமிருந்து பெறப்பட்ட 24-மணி நேர நீக்கக் கோரிக்கைகள்'
          : '24-hour statutory removal requests from members and the public',
      urgent: queues.galleryRemovals.escalated18H > 0 || queues.galleryRemovals.open > 0,
      urgentNotice:
        queues.galleryRemovals.escalated18H > 0
          ? locale === 'ta'
            ? `${queues.galleryRemovals.escalated18H} கோரிக்கைகள் 18 மணி நேரத்திற்கு மேலாகத் திறக்கப்பட்டுள்ளன`
            : `${queues.galleryRemovals.escalated18H} requests open 18+ hours (escalated to Tier 5)`
          : undefined,
    });
  }

  if (queues.galleryAlbums) {
    cards.push({
      title: locale === 'ta' ? 'புகைப்படத் தொகுப்புகள்' : 'Gallery albums',
      href: '/gallery?tab=albums',
      count: queues.galleryAlbums.submitted,
      countLabel: locale === 'ta' ? 'மதிப்பாய்வுக்குச் சமர்ப்பிக்கப்பட்டவை' : 'albums submitted for review',
      subtext:
        locale === 'ta'
          ? `${queues.galleryAlbums.drafts} வரைவு நிலையில் உள்ளவை`
          : `${queues.galleryAlbums.drafts} drafts in preparation`,
      urgent: queues.galleryAlbums.submitted > 0,
    });
  }

  if (queues.events) {
    cards.push({
      title: locale === 'ta' ? 'நிகழ்வுகள் மேலாண்மை' : 'Event console',
      href: '/events',
      count: queues.events.drafts,
      countLabel: locale === 'ta' ? 'வரைவு நிகழ்வுகள்' : 'draft events needing action',
      subtext:
        locale === 'ta'
          ? `${queues.events.published} வெளியிடப்பட்ட நிகழ்வுகள் · ${queues.events.total} மொத்தம்`
          : `${queues.events.published} published events · ${queues.events.total} total managed`,
      urgent: queues.events.drafts > 0,
    });
  }

  if (queues.messaging) {
    cards.push({
      title: locale === 'ta' ? 'அறிவித்தல்கள் & செய்திகள்' : 'Broadcasts & messaging',
      href: '/messages',
      count: queues.messaging.pendingApproval,
      countLabel: locale === 'ta' ? 'ஒப்புதலுக்குக் காத்திருக்கும் அறிவித்தல்கள்' : 'broadcasts pending approval',
      subtext:
        locale === 'ta'
          ? `${queues.messaging.drafts} வரைவுகள் தயார்நிலையில்`
          : `${queues.messaging.drafts} drafts in progress`,
      urgent: queues.messaging.pendingApproval > 0,
    });
  }

  if (queues.configuration) {
    cards.push({
      title: locale === 'ta' ? 'கணினி அமைப்புகள்' : 'Feature flags & settings',
      href: '/settings',
      count: queues.configuration.enabled,
      countLabel:
        locale === 'ta'
          ? `${queues.configuration.total} செயல்பாடுகளில் இயங்குபவை`
          : `of ${queues.configuration.total} feature modules active`,
      subtext:
        locale === 'ta'
          ? 'கட்டக் கட்டுப்பாடுகள் மற்றும் கட்டமைப்பு மாற்றிகள்'
          : 'Phase gates and module switches for v1.1 architecture',
    });
  }

  if (cards.length === 0) {
    return (
      <section aria-labelledby="priority-heading" className="flex flex-col gap-3">
        <h2 id="priority-heading" className="text-base font-bold text-text">
          <span lang={locale}>{locale === 'ta' ? 'முன்னுரிமைப் பணி வரிசைகள்' : 'Priority work queues'}</span>
        </h2>
        {queues.unavailable && queues.unavailable.length > 0 ? (
          <p className="rounded-xl border border-warning bg-warning-bg p-4 text-sm text-warning">
            ! {locale === 'ta' ? 'சில பணி வரிசைத் தரவுகளைப் பெற முடியவில்லை' : 'Some work queue counts could not be retrieved'} ({queues.unavailable.join(', ')}).
          </p>
        ) : (
          <p className="rounded-xl border border-line bg-card p-4 text-sm text-muted">
            {locale === 'ta'
              ? 'உங்கள் பணியாளர் பொறுப்புக்கு எந்தவொரு செயல்பாட்டு வரிசையையும் அணுக அனுமதி இல்லை.'
              : 'Your active staff roles do not grant access to operational work queues.'}
          </p>
        )}
      </section>
    );
  }

  const totalUrgent = cards.reduce((sum, c) => sum + (c.urgent ? c.count : 0), 0);

  return (
    <section aria-labelledby="priority-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="priority-heading" className="text-base font-bold text-text">
          <span lang={locale}>{locale === 'ta' ? 'முன்னுரிமைப் பணி வரிசைகள்' : 'Priority work queues'}</span>
        </h2>
        <span className="text-xs text-muted">
          {totalUrgent > 0
            ? locale === 'ta'
              ? `${totalUrgent} பணிகள் உடனடி நடவடிக்கையை எதிர்பார்க்கின்றன`
              : `${totalUrgent} items requiring staff action`
            : locale === 'ta'
              ? 'நிலுவையில் அவசரப் பணிகள் எதுவுமில்லை'
              : 'All assigned queues clear'}
        </span>
      </div>

      {queues.unavailable && queues.unavailable.length > 0 ? (
        <p className="rounded-xl border border-warning/50 bg-warning-bg p-3 text-xs text-warning">
          ! {locale === 'ta' ? 'சில பணி வரிசைகள் தற்காலிகமாகக் கிடைக்கவில்லை' : 'Some work queues could not be retrieved and are temporarily unavailable'} ({queues.unavailable.join(', ')}).
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
              <span lang={locale} className="font-semibold text-text">
                {card.title}
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
  const locale = await getAdminLocale(staff.member.language);

  const allowed = builtModules.filter((module) =>
    Array.isArray(module.permission)
      ? module.permission.some((p) => staff.permissions.has(p))
      : staff.permissions.has(module.permission as string),
  );

  return (
    <section aria-labelledby="modules-heading" className="flex flex-col gap-3">
      <h2 id="modules-heading" className="text-base font-bold text-text">
        <span lang={locale}>{locale === 'ta' ? 'ஒதுக்கப்பட்ட அனைத்துத் தொகுதிகள்' : 'All assigned modules'}</span>
      </h2>
      {allowed.length === 0 ? (
        <p className="text-sm text-muted">
          {locale === 'ta' ? 'உங்கள் பொறுப்புக்கு எந்த தொகுதியும் ஒதுக்கப்படவில்லை.' : 'Your role has no dashboard modules.'}
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allowed.map((module) => (
          <li key={module.href}>
            <Link
              href={module.href}
              className="flex min-h-20 flex-col gap-0.5 rounded-xl border border-line bg-card p-4 hover:bg-surface">
              <span lang={locale} className="text-sm font-semibold text-text">
                {locale === 'ta' ? module.ta : module.en}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
