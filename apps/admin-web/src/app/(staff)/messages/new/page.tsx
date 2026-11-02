import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { createBroadcast } from '@/features/messages/actions';
import { requireStaff } from '@/lib/staff';

export default function NewBroadcastPage(props: PageProps<'/messages/new'>) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/messages" className="text-sm font-semibold text-primary underline">
          ← Back to broadcasts
        </Link>
      </div>

      <PageHeader ta="புதிய அறிவித்தலை உருவாக்குதல்" en="Compose staff broadcast" brd="D09, GAP-05, FR-ADM-007" />

      {/* Security Warning Banner */}
      <section aria-labelledby="policy-notice" className="rounded-xl border border-warning bg-warning-bg p-4 text-warning text-sm">
        <h2 id="policy-notice" className="font-bold">
          ! Privacy and Sensitive Data Policy
        </h2>
        <p className="mt-1">
          Do not include National Identity Card (NIC) numbers, passport numbers, phone numbers, or private case records
          in broadcasts. Broadcasts reach all members in the target geography and cannot be recalled once sent.
        </p>
      </section>

      <Suspense fallback={<p className="text-muted">… Loading form</p>}>
        <NewBroadcastForm searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewBroadcastForm({ searchParams }: { searchParams: PageProps<'/messages/new'>['searchParams'] }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const problems = Array.isArray(params.problems) ? params.problems[0] : params.problems;

  // Assignments where staff holds notifications.send
  const sendAssignments = staff.assignments.filter((a) => a.permissions.includes('notifications.send'));

  return (
    <>
      <Feedback error={error} problems={problems} />

      <form action={createBroadcast} className="flex flex-col gap-6 rounded-xl border border-line bg-card p-6">
        <section aria-labelledby="section-audience" className="flex flex-col gap-4">
          <h2 id="section-audience" className="text-base font-bold">
            1. Topic & Audience scope
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Topic *
              <select name="topic" required defaultValue="announcements" className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                <option value="announcements">Announcement (respects quiet hours & silence windows)</option>
                <option value="emergency">Emergency alert (urgent, bypasses quiet hours)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Audience geography (scoped to your role) *
              <select name="areaSelection" required className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                {sendAssignments.map((a) => {
                  const label = a.area.level === 'platform' ? 'Platform wide (All Sri Lanka)' : `${a.area.level} ${a.area.code}`;
                  const value = `${a.area.level}:${a.area.code ?? ''}`;
                  return (
                    <option key={a.id} value={value}>
                      {label} (Tier {a.tier})
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </section>

        <section aria-labelledby="section-content" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-content" className="text-base font-bold">
            2. Bilingual content
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Title (English) *
              <input
                name="titleEn"
                required
                maxLength={80}
                placeholder="e.g. Flood Relief Distribution Notice"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Title (Tamil / தமிழ்) *
              <input
                name="titleTa"
                required
                maxLength={80}
                placeholder="எ.கா. வெள்ள நிவாரண உதவி அறிவிப்பு"
                lang="ta"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Message body (English) *
              <textarea
                name="bodyEn"
                required
                rows={5}
                maxLength={1000}
                placeholder="Detailed announcement text..."
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Message body (Tamil / தமிழ்) *
              <textarea
                name="bodyTa"
                required
                rows={5}
                maxLength={1000}
                placeholder="முழுமையான அறிவித்தல் விபரம்..."
                lang="ta"
                className="rounded-lg border border-line p-3"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          <Link href="/messages" className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-surface">
            Cancel
          </Link>
          <SubmitButton tone="primary">Save draft broadcast</SubmitButton>
        </div>
      </form>
    </>
  );
}
