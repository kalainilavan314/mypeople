import Link from 'next/link';
import { Suspense } from 'react';
import type { AreaRef, StaffTier } from '@my-people/api-client';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { createBroadcast } from '@/features/messages/actions';
import { AudienceScopePicker, STAFF_TIERS } from '@/features/messages/AudienceScopePicker';
import { getAdminLocale } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

export default function NewBroadcastPage(props: PageProps<'/messages/new'>) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/messages" className="text-sm font-semibold text-primary underline">
          ← Back to broadcasts
        </Link>
      </div>

      <PageHeader ta="புதிய அறிவித்தலை உருவாக்குதல்" en="Compose staff broadcast" />

      <Suspense fallback={<p className="text-muted">… Loading form</p>}>
        <NewBroadcastForm searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewBroadcastForm({ searchParams }: { searchParams: PageProps<'/messages/new'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const problems = Array.isArray(params.problems) ? params.problems[0] : params.problems;

  // Assignments where staff holds notifications.send
  const sendAssignments = staff.assignments.filter((a) => a.permissions.includes('notifications.send'));
  if (sendAssignments.length === 0) {
    return <p className="rounded-lg border border-line bg-card p-5 text-sm text-muted">Your active role does not allow broadcast messaging.</p>;
  }
  const api = await staffApi();
  const uniqueAreas = new Map<string, { area: AreaRef; grants: StaffTier[] }>();
  for (const assignment of sendAssignments) {
    const value = `${assignment.area.level}:${assignment.area.code ?? ''}`;
    const existing = uniqueAreas.get(value);
    if (existing) existing.grants.push(assignment.tier);
    else uniqueAreas.set(value, { area: assignment.area, grants: [assignment.tier] });
  }
  const requests = [...uniqueAreas.entries()].flatMap(([value, option]) => [
    { value, key: 'all' as const, request: api.estimateBroadcastReach(option.area) },
    ...STAFF_TIERS.map((tier) => ({ value, key: tier, request: api.estimateBroadcastReach(option.area, [tier]) })),
  ]);
  const reachResults = await Promise.allSettled(requests.map(({ request }) => request));
  const reaches = new Map<string, Partial<Record<'all' | StaffTier, number | null>>>();
  requests.forEach((request, index) => {
    const areaReaches = reaches.get(request.value) ?? {};
    const result = reachResults[index];
    areaReaches[request.key] = result.status === 'fulfilled' ? result.value.reaches : null;
    reaches.set(request.value, areaReaches);
  });
  const areaOptions = [...uniqueAreas.entries()].map(([value, option]) => ({
    value,
    label: `${option.area.level === 'platform' ? 'Platform wide (All Sri Lanka)' : `${option.area.level.toUpperCase()} ${option.area.code}`} · access through Tier ${[...new Set(option.grants)].join(', ')}`,
    reaches: reaches.get(value) ?? {},
  }));

  return (
    <>
      <Feedback error={error} problems={problems} />

      {/* Security Warning Banner */}
      <section aria-labelledby="policy-notice" className="rounded-xl border border-warning bg-warning-bg p-4 text-warning text-sm">
        <h2 id="policy-notice" className="font-bold">
          ! {locale === 'ta' ? 'தனியுரிமை மற்றும் முக்கியமான தரவுக் கொள்கை' : 'Privacy and Sensitive Data Policy'}
        </h2>
        <p className="mt-1">
          {locale === 'ta'
            ? 'தேசிய அடையாள அட்டை (NIC) எண்கள், கடவுச்சீட்டு எண்கள், தொலைபேசி எண்கள் அல்லது தனிப்பட்ட கோப்புப் பதிவுகளை அறிவித்தல்களில் சேர்க்க வேண்டாம். இலக்குப் பகுதியிலுள்ள அனைத்து உறுப்பினர்களையும் சென்றடையும் இவ்வறிவித்தல்கள், அனுப்பிய பின் மீளப்பெறப்பட முடியாது.'
            : 'Do not include National Identity Card (NIC) numbers, passport numbers, phone numbers, or private case records in broadcasts. Broadcasts reach all members in the target geography and cannot be recalled once sent.'}
        </p>
      </section>

      <form action={createBroadcast} className="flex flex-col gap-6 rounded-xl border border-line bg-card p-6">
        <section aria-labelledby="section-audience" className="flex flex-col gap-4">
          <h2 id="section-audience" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? '1. தலைப்பு வகை & இலக்குப் பகுதி' : '1. Topic & Audience scope'}</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2 sm:max-w-md">
              <span lang={locale}>{locale === 'ta' ? 'தலைப்பு வகை *' : 'Topic *'}</span>
              <select name="topic" required defaultValue="announcements" className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                <option value="announcements">
                  {locale === 'ta' ? 'பொது அறிவித்தல் (அமைதி நேரக் கட்டுப்பாடுகளுக்கு உட்பட்டது)' : 'Announcement (respects quiet hours & silence windows)'}
                </option>
                <option value="emergency">
                  {locale === 'ta' ? 'அவசர எச்சரிக்கை (உடனடியானது, அமைதி நேரங்களைத் தவிர்க்கும்)' : 'Emergency alert (urgent, bypasses quiet hours)'}
                </option>
              </select>
            </label>

            <AudienceScopePicker options={areaOptions} />
          </div>
        </section>

        <section aria-labelledby="section-content" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-content" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? '2. இருமொழி உள்ளடக்கம்' : '2. Bilingual content'}</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'தலைப்பு (ஆங்கிலம்) *' : 'Title (English) *'}</span>
              <input
                name="titleEn"
                required
                maxLength={80}
                placeholder={locale === 'ta' ? 'எ.கா. Flood Relief Distribution Notice' : 'e.g. Flood Relief Distribution Notice'}
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'தலைப்பு (தமிழ்) *' : 'Title (Tamil) *'}</span>
              <input
                name="titleTa"
                required
                maxLength={80}
                placeholder={locale === 'ta' ? 'எ.கா. வெள்ள நிவாரண உதவி அறிவிப்பு' : 'e.g. Flood relief notice in Tamil'}
                lang="ta"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'செய்தி விவரம் (ஆங்கிலம்) *' : 'Message body (English) *'}</span>
              <textarea
                name="bodyEn"
                required
                rows={5}
                maxLength={1000}
                placeholder={locale === 'ta' ? 'ஆங்கில அறிவித்தல் விவரம்...' : 'Detailed announcement text...'}
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'செய்தி விவரம் (தமிழ்) *' : 'Message body (Tamil) *'}</span>
              <textarea
                name="bodyTa"
                required
                rows={5}
                maxLength={1000}
                placeholder={locale === 'ta' ? 'முழுமையான அறிவித்தல் விபரம்...' : 'Tamil message body...'}
                lang="ta"
                className="rounded-lg border border-line p-3"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          <Link href="/messages" className="flex min-h-11 items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-surface">
            <span lang={locale}>{locale === 'ta' ? 'கைவிடுக' : 'Cancel'}</span>
          </Link>
          <SubmitButton tone="primary">
            <span lang={locale}>{locale === 'ta' ? 'வரைவு அறிவித்தலைச் சேமிக்க' : 'Save draft broadcast'}</span>
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
