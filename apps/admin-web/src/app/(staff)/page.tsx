import type { WorkQueues } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { BarChart, RingChart } from '@/components/MiniCharts';
import { ACCENT_TILE, getModuleIcon, moduleAccent, type Accent } from '@/components/ModuleIcons';
import { StatCard } from '@/components/StatCard';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { DashboardRefresh } from '@/components/DashboardRefresh';
import { SystemStatus } from '@/components/SystemStatus';
import { getAdminLocale, type Locale } from '@/lib/i18n';
import { builtModules, plannedModules } from '@/lib/modules';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

export default function DashboardHome() {
  return (
    <>
      <Suspense fallback={<div className="h-36 animate-pulse rounded-2xl bg-surface" />}>
        <WelcomeBanner />
      </Suspense>

      <Suspense fallback={null}>
        <DashboardNotice />
      </Suspense>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <Suspense fallback={<ConsoleLoading rows={4} />}>
            <PriorityWorkQueues />
          </Suspense>
          <Suspense fallback={<ConsoleLoading rows={2} />}>
            <InsightsSection />
          </Suspense>
        </div>

        <aside className="flex flex-col gap-8 xl:sticky xl:top-6" aria-label="Administration overview">
          <Suspense fallback={<ConsoleLoading rows={3} />}>
            <MyModules />
          </Suspense>

          <Suspense fallback={<p className="text-sm text-muted">Loading system status…</p>}>
            <StatusSection />
          </Suspense>

          <Suspense fallback={<p className="text-sm text-muted">Loading planned modules…</p>}>
            <PlannedModulesSection />
          </Suspense>
        </aside>
      </div>
    </>
  );
}

/** The page's h1: a brand banner greeting the staff member, with the date and the refresh control. */
async function WelcomeBanner() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const firstName = staff.member.fullName.split(' ')[0];
  const today = new Intl.DateTimeFormat(locale === 'ta' ? 'ta-LK' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  }).format(new Date());

  return (
    <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-on-primary shadow-raised sm:p-8">
      <span aria-hidden="true" className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-on-primary/10" />
      <span aria-hidden="true" className="absolute -bottom-16 right-24 h-36 w-36 rounded-full bg-brand-gold/25" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-2">
          <p lang={locale} className="text-sm font-medium text-on-primary/85">
            {today}
          </p>
          <h1 lang={locale} className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {locale === 'ta' ? `வணக்கம், ${firstName}` : `Welcome back, ${firstName}`}
          </h1>
          <p lang={locale} className="text-sm leading-6 text-on-primary/90">
            {locale === 'ta'
              ? 'உங்கள் பணி வரிசைகள், அனுமதிகள் மற்றும் கருவிகள் ஒரே இடத்தில்.'
              : 'Your work queues, approvals and tools in one place.'}
          </p>
        </div>
        <DashboardRefresh onBrand />
      </div>
    </header>
  );
}
async function DashboardNotice() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);

  return (
    <p className="flex flex-col gap-1 rounded-2xl border border-warning/40 bg-warning-bg px-5 py-3 text-sm text-warning">
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
      <h2 id="status-heading" className="text-sm font-semibold text-text">
        <span lang={locale}>{locale === 'ta' ? 'கணினி நிலைமை' : 'System status'}</span>
      </h2>
      <SystemStatus locale={locale} />
    </section>
  );
}

// A planned module waiting on an outside decision says what it waits for; a bare phase would
// suggest it is merely scheduled. (D30 official publishing is built: its key is a server setting
// until a KMS is chosen, INT-24.)
const WAITING_ON: Readonly<Record<string, { ta: string; en: string }>> = {};

function waitingLabel(name: string, locale: Locale): string {
  const waiting = WAITING_ON[name];
  return waiting ? waiting[locale] : 'Phase 2 / 3';
}

async function PlannedModulesSection() {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);

  return (
    <section aria-labelledby="planned-heading" className="flex flex-col gap-3">
      <h2 id="planned-heading" className="text-sm font-semibold text-text">
        <span lang={locale}>{locale === 'ta' ? 'அடுத்தகட்ட தொகுதிகள் (கட்டம் 2 & 3)' : 'Planned modules'}</span>
      </h2>
      <ul className="divide-y divide-line rounded-lg border border-line bg-card">
        {plannedModules.map((module) => (
          <li key={module.name} className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span>
              <span lang={locale} className="block text-sm font-semibold text-text">
                {locale === 'ta' ? module.ta : module.name}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{module.desc}</span>
            </span>
            <span lang={locale} className="rounded-md bg-surface px-2 py-1 text-[11px] font-medium text-muted">
              {waitingLabel(module.name, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Each queue card in its own colour, so neighbouring cards are easy to tell apart. */
const QUEUE_ACCENTS: Readonly<Record<string, Accent>> = {
  '/verification': 'indigo',
  '/appeals': 'purple',
  '/duplicates': 'orange',
  '/membership': 'green',
  '/gallery?tab=removals': 'red',
  '/gallery?tab=albums': 'pink',
  '/events': 'blue',
  '/messages': 'gold',
  '/settings': 'teal',
  '/reports': 'red',
};

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
      <section aria-labelledby="priority-heading" className="flex flex-col gap-4">
        <h2 id="priority-heading" className="text-lg font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'முன்னுரிமைப் பணி வரிசைகள்' : 'Priority work queues'}</span>
        </h2>
        <p className="rounded-lg border border-line bg-card p-5 text-sm text-muted">
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

  if (queues.reports) {
    cards.push({
      title: 'Community reports',
      href: '/reports',
      count: queues.reports.totalActionable,
      countLabel: 'actionable reports',
      subtext: `${queues.reports.submitted} submitted · ${queues.reports.underReview} under review · ${queues.reports.inProgress} in progress`,
      urgent: queues.reports.totalActionable > 0,
    });
  }

  if (cards.length === 0) {
    return (
      <section aria-labelledby="priority-heading" className="flex flex-col gap-4">
        <h2 id="priority-heading" className="text-lg font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'முன்னுரிமைப் பணி வரிசைகள்' : 'Priority work queues'}</span>
        </h2>
        {queues.unavailable && queues.unavailable.length > 0 ? (
          <p className="rounded-lg border border-warning bg-warning-bg p-4 text-sm text-warning">
            ! {locale === 'ta' ? 'சில பணி வரிசைத் தரவுகளைப் பெற முடியவில்லை' : 'Some work queue counts could not be retrieved'} ({queues.unavailable.join(', ')}).
          </p>
        ) : (
          <p className="rounded-lg border border-line bg-card p-5 text-sm text-muted">
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
    <section aria-labelledby="priority-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="priority-heading" className="text-lg font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'முன்னுரிமைப் பணி வரிசைகள்' : 'Priority work queues'}</span>
          </h2>
          <p className="text-sm text-muted">Open a queue to review and record the next decision.</p>
        </div>
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
        <p className="rounded-lg border border-warning/50 bg-warning-bg p-3 text-xs text-warning">
          ! {locale === 'ta' ? 'சில பணி வரிசைகள் தற்காலிகமாகக் கிடைக்கவில்லை' : 'Some work queues could not be retrieved and are temporarily unavailable'} ({queues.unavailable.join(', ')}).
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.href} {...card} accent={QUEUE_ACCENTS[card.href]} locale={locale} />
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
      <h2 id="modules-heading" className="text-sm font-semibold text-text">
        <span lang={locale}>{locale === 'ta' ? 'ஒதுக்கப்பட்ட அனைத்துத் தொகுதிகள்' : 'Your modules'}</span>
      </h2>
      {allowed.length === 0 ? (
        <p className="text-sm text-muted">
          {locale === 'ta' ? 'உங்கள் பொறுப்புக்கு எந்த தொகுதியும் ஒதுக்கப்படவில்லை.' : 'Your role has no dashboard modules.'}
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-3">
        {allowed.map((module) => {
          const Icon = getModuleIcon(module.href);
          return (
            <li key={module.href}>
              <Link
                href={module.href}
                className="flex h-full min-h-24 flex-col items-start gap-2 rounded-2xl border border-line bg-card p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-lg ${ACCENT_TILE[moduleAccent(module.href)]}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span lang={locale} className="text-xs font-semibold leading-snug text-text">
                  {locale === 'ta' ? module.ta : module.en}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Last 30 days at a glance: the membership journey as bars, event attendance as a ring. */
async function InsightsSection() {
  const staff = await requireStaff();
  if (!staff.permissions.has('analytics.view')) return null;
  const locale = await getAdminLocale(staff.member.language);
  let figures: Awaited<ReturnType<Awaited<ReturnType<typeof staffApi>>['getOperationsAnalytics']>> | null = null;
  try {
    figures = await (await staffApi()).getOperationsAnalytics(30);
  } catch (error) {
    if (isRefusal(error)) return null;
    throw error;
  }
  const ta = locale === 'ta';
  const hours = figures.medianHours === null ? '—' : `${Math.round(figures.medianHours)} ${ta ? 'மணி' : 'h'}`;

  return (
    <section aria-labelledby="insights-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="insights-heading" lang={locale} className="text-lg font-semibold text-text">
          {ta ? 'கடந்த 30 நாட்கள்' : 'Last 30 days'}
        </h2>
        <Link href="/analytics" lang={locale} className="text-sm font-semibold text-primary hover:underline">
          {ta ? 'முழுப் பகுப்பாய்வு' : 'Full analytics'}
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
          <h3 lang={locale} className="text-sm font-semibold text-text-secondary">
            {ta ? 'உறுப்பினர் பயணம்' : 'Membership journey'}
          </h3>
          <BarChart
            locale={locale}
            caption={ta ? 'கடந்த 30 நாட்களின் உறுப்பினர் பயணம்' : 'Membership journey in the last 30 days'}
            bars={[
              { label: ta ? 'தொடங்கியவை' : 'Started', value: figures.started, accent: 'blue' },
              { label: ta ? 'சமர்ப்பித்தவை' : 'Submitted', value: figures.submitted, accent: 'purple' },
              { label: ta ? 'சரிபார்க்கப்பட்டவை' : 'Verified', value: figures.verified, accent: 'teal' },
              { label: ta ? 'செயலில்' : 'Active', value: figures.active, accent: 'green' },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-card p-5 shadow-card">
            <RingChart value={figures.attendanceRate} locale={locale} label={ta ? 'நிகழ்வு வருகை' : 'Event attendance'} />
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
            <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${ACCENT_TILE.orange}`}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div className="flex flex-col">
              <span lang={locale} className="text-xs font-medium text-muted">
                {ta ? 'சரிபார்ப்புக்கான நடுத்தரக் காத்திருப்பு' : 'Median review wait'}
              </span>
              <span className="text-2xl font-bold tabular-nums text-text">{hours}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
