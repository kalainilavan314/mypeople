import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { createAlbum } from '@/features/gallery/actions';
import { requireStaff } from '@/lib/staff';

export default function NewAlbumPage(props: PageProps<'/gallery/new'>) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/gallery" className="text-sm font-semibold text-primary underline">
          ← Back to gallery console
        </Link>
      </div>

      <PageHeader ta="புதிய புகைப்படத் தொகுப்பை உருவாக்குதல்" en="Create draft album" brd="D08, FR-ADM-005" />

      <Suspense fallback={<p className="text-muted">… Loading form</p>}>
        <NewAlbumForm searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewAlbumForm({ searchParams }: { searchParams: PageProps<'/gallery/new'>['searchParams'] }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const problems = Array.isArray(params.problems) ? params.problems[0] : params.problems;

  // Assignments where staff holds gallery.publish
  const publishAssignments = staff.assignments.filter((a) => a.permissions.includes('gallery.publish'));

  return (
    <>
      <Feedback error={error} problems={problems} />

      <form action={createAlbum} className="flex flex-col gap-6 rounded-xl border border-line bg-card p-6">
        <section aria-labelledby="section-basic" className="flex flex-col gap-4">
          <h2 id="section-basic" className="text-base font-bold">
            1. Album identity
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Title (English) *
              <input
                name="titleEn"
                required
                maxLength={160}
                placeholder="e.g. Vavuniya Community Outreach Day"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Title (Tamil / தமிழ்) *
              <input
                name="titleTa"
                required
                maxLength={160}
                placeholder="எ.கா. வவுனியா சமூக விழிப்புணர்வு நாள்"
                lang="ta"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Category *
              <select name="category" required defaultValue="community" className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                <option value="community">Community</option>
                <option value="events">Events</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Area *
              <select name="areaSelection" required className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                {publishAssignments.map((a) => {
                  const label = a.area.level === 'platform' ? 'Platform wide' : `${a.area.level} ${a.area.code}`;
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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Summary (English)
              <textarea
                name="summaryEn"
                rows={3}
                maxLength={2000}
                placeholder="Brief summary of what this album documents..."
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Summary (Tamil / தமிழ்)
              <textarea
                name="summaryTa"
                rows={3}
                maxLength={2000}
                placeholder="இந்தத் தொகுப்பு ஆவணப்படுத்தும் சுருக்கம்..."
                lang="ta"
                className="rounded-lg border border-line p-3"
              />
            </label>
          </div>
        </section>

        <section aria-labelledby="section-metadata" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-metadata" className="text-base font-bold">
            2. Location, date and publisher credit
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Place / Venue name
              <input
                name="place"
                maxLength={200}
                placeholder="e.g. Vavuniya Cultural Hall"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Album date *
              <input name="albumDate" type="date" required className="min-h-11 rounded-lg border border-line px-3" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Publisher credit *
              <input
                name="publisher"
                required
                maxLength={160}
                placeholder="e.g. Northern Province Media Team"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-semibold">
              Linked event ID (optional, for Events category)
              <input
                name="eventId"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="min-h-11 rounded-lg border border-line px-3 font-mono text-xs"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          <Link href="/gallery" className="min-h-11 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-surface">
            Cancel
          </Link>
          <SubmitButton tone="primary">Save draft album</SubmitButton>
        </div>
      </form>
    </>
  );
}
