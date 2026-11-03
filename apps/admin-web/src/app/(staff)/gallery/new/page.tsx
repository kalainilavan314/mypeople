import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { SubmitButton } from '@/components/SubmitButton';
import { createAlbum } from '@/features/gallery/actions';
import { getAdminLocale } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

export default function NewAlbumPage(props: PageProps<'/gallery/new'>) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/gallery" className="text-sm font-semibold text-primary underline">
          ← Back to gallery console
        </Link>
      </div>

      <PageHeader ta="புதிய புகைப்படத் தொகுப்பை உருவாக்குதல்" en="Create draft album" />

      <Suspense fallback={<p className="text-muted">… Loading form</p>}>
        <NewAlbumForm searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function NewAlbumForm({ searchParams }: { searchParams: PageProps<'/gallery/new'>['searchParams'] }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
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
          <h2 id="section-basic" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? '1. புகைப்படத் தொகுப்பின் அடையாளம்' : '1. Album identity'}</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="input-titleTa" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'தொகுப்புத் தலைப்பு (தமிழ்) *' : 'Title (Tamil) *'}</span>
              <input
                id="input-titleTa"
                name="titleTa"
                required
                maxLength={160}
                placeholder={locale === 'ta' ? 'எ.கா. வவுனியா சமூக விழிப்புணர்வு நாள்' : 'e.g. Vavuniya Community Outreach Day'}
                lang="ta"
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label htmlFor="input-titleEn" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'தொகுப்புத் தலைப்பு (ஆங்கிலம்) *' : 'Title (English) *'}</span>
              <input
                id="input-titleEn"
                name="titleEn"
                required
                maxLength={160}
                placeholder={locale === 'ta' ? 'எ.கா. Vavuniya Community Outreach Day' : 'e.g. Vavuniya Community Outreach Day'}
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="input-category" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'பிரிவு *' : 'Category *'}</span>
              <select id="input-category" name="category" required defaultValue="community" className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                <option value="community">{locale === 'ta' ? 'சமூகம் (Community)' : 'Community'}</option>
                <option value="events">{locale === 'ta' ? 'நிகழ்வுகள் (Events)' : 'Events'}</option>
              </select>
            </label>

            <label htmlFor="input-area" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'பகுதி *' : 'Area *'}</span>
              <select id="input-area" name="areaSelection" required className="min-h-11 rounded-lg border border-line px-3 bg-surface">
                {publishAssignments.map((a) => {
                  const label = a.area.level === 'platform' ? (locale === 'ta' ? 'நாடு முழுவதும்' : 'Platform wide') : `${a.area.level} ${a.area.code}`;
                  const value = `${a.area.level}:${a.area.code ?? ''}`;
                  return (
                    <option key={a.id} value={value}>
                      {label} ({locale === 'ta' ? 'நிலை' : 'Tier'} {a.tier})
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="input-summaryTa" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'சுருக்கம் (தமிழ்)' : 'Summary (Tamil)'}</span>
              <textarea
                id="input-summaryTa"
                name="summaryTa"
                rows={3}
                maxLength={2000}
                placeholder={locale === 'ta' ? 'இந்தத் தொகுப்பு ஆவணப்படுத்தும் சுருக்கம்...' : 'Brief summary in Tamil...'}
                lang="ta"
                className="rounded-lg border border-line p-3"
              />
            </label>

            <label htmlFor="input-summaryEn" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'சுருக்கம் (ஆங்கிலம்)' : 'Summary (English)'}</span>
              <textarea
                id="input-summaryEn"
                name="summaryEn"
                rows={3}
                maxLength={2000}
                placeholder={locale === 'ta' ? 'தொகுப்பின் ஆங்கிலச் சுருக்கம்...' : 'Brief summary of what this album documents...'}
                className="rounded-lg border border-line p-3"
              />
            </label>
          </div>
        </section>

        <section aria-labelledby="section-metadata" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="section-metadata" className="text-base font-bold text-text">
            <span lang={locale}>{locale === 'ta' ? '2. இடம், திகதி மற்றும் வெளியீட்டாளர் விவரம்' : '2. Location, date and publisher credit'}</span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="input-place" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'நடைபெறும் இடம் / மண்டபம்' : 'Place / Venue name'}</span>
              <input
                id="input-place"
                name="place"
                maxLength={200}
                placeholder={locale === 'ta' ? 'எ.கா. வவுனியா கலாசார மண்டபம்' : 'e.g. Vavuniya Cultural Hall'}
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label htmlFor="input-albumDate" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'திகதி *' : 'Album date *'}</span>
              <input id="input-albumDate" name="albumDate" type="date" required className="min-h-11 rounded-lg border border-line px-3" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="input-publisher" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'வெளியீட்டாளர் பெயர் *' : 'Publisher credit *'}</span>
              <input
                id="input-publisher"
                name="publisher"
                required
                maxLength={160}
                placeholder={locale === 'ta' ? 'எ.கா. வட மாகாண ஊடகப் பிரிவு' : 'e.g. Northern Province Media Unit'}
                className="min-h-11 rounded-lg border border-line px-3"
              />
            </label>

            <label htmlFor="input-eventId" className="flex flex-col gap-1 text-sm font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'தொடர்புடைய நிகழ்வு இலக்கம் (விருப்பத்தேர்வு)' : 'Linked event ID (optional, for Events category)'}</span>
              <input
                id="input-eventId"
                name="eventId"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="min-h-11 rounded-lg border border-line px-3 font-mono text-xs"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
          <Link href="/gallery" className="flex min-h-11 items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-surface">
            <span lang={locale}>{locale === 'ta' ? 'கைவிடுக' : 'Cancel'}</span>
          </Link>
          <SubmitButton tone="primary">
            <span lang={locale}>{locale === 'ta' ? 'வரைவுத் தொகுப்பைச் சேமிக்க' : 'Save draft album'}</span>
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
