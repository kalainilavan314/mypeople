import type { ManagedAlbum } from '@my-people/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import {
  deletePhoto,
  publishAlbum,
  returnAlbum,
  submitAlbum,
  updatePhotoCaptions,
  uploadPhoto,
} from '@/features/gallery/actions';
import { formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

export default function AlbumDetailPage(props: PageProps<'/gallery/albums/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading album</p>}>
      <AlbumDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AlbumDetail({ params, searchParams }: Pick<PageProps<'/gallery/albums/[id]'>, 'params' | 'searchParams'>) {
  const staff = await requireStaff();
  const { id } = await params;
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const problems = Array.isArray(query.problems) ? query.problems[0] : query.problems;
  const done = Array.isArray(query.done) ? query.done[0] : query.done;

  const locale = await getAdminLocale(staff.member.language);
  const api = await staffApi();
  let album: ManagedAlbum;

  try {
    album = await api.getManagedAlbum(id);
  } catch (err) {
    if (isRefusal(err)) {
      return (
        <div className="flex flex-col gap-4">
          <Link href="/gallery" className="text-sm font-semibold text-primary underline">
            <span lang={locale}>{locale === 'ta' ? '← புகைப்படத் தொகுப்புகளுக்குத் திரும்புக' : '← Back to gallery'}</span>
          </Link>
          <p className="text-error">! {getLocalizedMessage(err.code, locale)}</p>
        </div>
      );
    }
    throw err;
  }

  const isDraft = album.state === 'draft';
  const isSubmitted = album.state === 'submitted';
  const isPublished = album.state === 'published';

  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/gallery" className="text-sm font-semibold text-primary underline">
          <span lang={locale}>{locale === 'ta' ? '← புகைப்படத் தொகுப்புகளுக்குத் திரும்புக' : '← Back to gallery console'}</span>
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted">{album.albumRef}</span>
            <StateTag state={album.state} />
          </div>
          <h1 lang={locale} className="text-2xl font-bold text-text">
            {locale === 'ta' ? album.titleTa || album.titleEn : album.titleEn || album.titleTa}
          </h1>
          <p className="text-xs text-muted">
            {locale === 'ta' ? 'பிரிவு:' : 'Category:'} {album.category} · {locale === 'ta' ? 'வெளியீட்டாளர்:' : 'Publisher:'} {album.publisher} · {locale === 'ta' ? 'திகதி:' : 'Date:'} {formatDate(album.albumDate)}
          </p>
        </div>
      </header>

      <Feedback error={error} problems={problems} done={done} />

      {album.returnNote ? (
        <section aria-labelledby="return-note" className="rounded-xl border border-warning bg-warning-bg p-4 text-warning">
          <h2 id="return-note" className="font-bold">
            ! {locale === 'ta' ? 'வரைவு நிலைக்குத் திருப்பப்பட்டது' : 'Returned to draft'}
          </h2>
          <p className="mt-1 text-sm">{album.returnNote}</p>
        </section>
      ) : null}

      {/* Album Summary Section */}
      <div className="rounded-xl border border-line bg-card p-6">
        <div>
          <span className="text-xs font-semibold text-muted">
            {locale === 'ta' ? 'சுருக்கம்' : 'Summary'}
          </span>
          <p lang={locale} className="mt-1 text-sm font-medium text-text">
            {(locale === 'ta' ? album.summaryTa : album.summaryEn) || '—'}
          </p>
        </div>
        {(locale === 'ta' ? album.summaryEn : album.summaryTa) ? (
          <details className="mt-4 border-t border-line pt-3 text-xs text-muted">
            <summary className="cursor-pointer font-medium hover:text-text">
              {locale === 'ta' ? 'ஆங்கிலச் சுருக்கத்தைக் காட்டு' : 'View Tamil summary'}
            </summary>
            <p lang={locale === 'ta' ? 'en' : 'ta'} className="mt-2 text-sm text-text">
              {locale === 'ta' ? album.summaryEn : album.summaryTa}
            </p>
          </details>
        ) : null}
      </div>

      {/* Photos Management */}
      <section aria-labelledby="photos-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
          <h2 id="photos-heading" className="text-base font-bold text-text">
            {locale === 'ta' ? `புகைப்படங்கள் (${album.photos.length})` : `Photos (${album.photos.length})`}
          </h2>
          <span className="text-xs text-muted">
            {isDraft
              ? (locale === 'ta' ? 'WebP மாற்றத்தின் போது EXIF மற்றும் GPS இருப்பிடத் தகவல்கள் நீக்கப்படும்.' : 'WebP conversion on upload removes all EXIF and GPS coordinates.')
              : (locale === 'ta' ? 'வெளியிடப்பட்ட புகைப்படங்கள்' : 'Published photos')}
          </span>
        </div>

        {/* Upload form for drafts */}
        {isDraft ? (
          <form action={uploadPhoto} className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4">
            <input type="hidden" name="albumId" value={album.id} />
            <label className="flex flex-col gap-1 text-xs font-semibold">
              <span lang={locale}>{locale === 'ta' ? 'புகைப்படம் சேர்த்தல் (JPEG, PNG அல்லது WebP, அதிகபட்சம் 15MB)' : 'Add photo (JPEG, PNG or WebP, up to 15MB)'}</span>
              <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="text-xs" />
            </label>
            <SubmitButton tone="secondary">
              <span lang={locale}>{locale === 'ta' ? 'புகைப்படத்தைப் பதிவேற்றுக' : 'Upload photo'}</span>
            </SubmitButton>
          </form>
        ) : null}

        {album.photos.length === 0 ? (
          <p className="text-sm text-muted">
            {locale === 'ta' ? 'இந்தத் தொகுப்பில் இன்னும் புகைப்படங்கள் இல்லை.' : 'No photos in this album yet.'}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {album.photos.map((photo) => (
              <div key={photo.id} className="flex flex-col gap-3 rounded-lg border border-line p-3">
                <div className="flex gap-3">
                  <Image
                    src={`/evidence/photo/${photo.id}/thumb`}
                    alt={`Photo #${photo.number}`}
                    width={96}
                    height={96}
                    className="size-24 rounded object-cover border border-line bg-surface shrink-0"
                    unoptimized
                  />
                  <div className="flex flex-col gap-1 text-xs text-muted">
                    <span className="font-mono font-bold text-foreground">
                      {locale === 'ta' ? `புகைப்படம் #${photo.number}` : `Photo #${photo.number}`}
                    </span>
                    <span>
                      {photo.width} × {photo.height} px
                    </span>
                    {photo.blurred ? (
                      <span className="font-semibold text-warning">{locale === 'ta' ? 'மங்கலாக்கப்பட்டது' : 'Blurred'}</span>
                    ) : null}
                  </div>
                </div>

                {isDraft ? (
                  <form action={updatePhotoCaptions} className="flex flex-col gap-2 border-t border-line pt-2">
                    <input type="hidden" name="albumId" value={album.id} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <label className="flex flex-col gap-0.5 text-xs font-semibold">
                      <span lang={locale}>{locale === 'ta' ? 'விளக்கக் குறிப்பு (ஆங்கிலம்)' : 'Caption (English)'}</span>
                      <input
                        name="captionEn"
                        defaultValue={photo.captionEn}
                        maxLength={500}
                        placeholder={locale === 'ta' ? 'ஆங்கிலக் குறிப்புரை...' : 'English caption...'}
                        className="rounded border border-line px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-xs font-semibold">
                      <span lang={locale}>{locale === 'ta' ? 'விளக்கக் குறிப்பு (தமிழ்) *' : 'Caption (Tamil) *'}</span>
                      <input
                        name="captionTa"
                        defaultValue={photo.captionTa}
                        maxLength={500}
                        lang="ta"
                        placeholder="தமிழ்க் குறிப்புரை..."
                        className="rounded border border-line px-2 py-1 text-xs"
                      />
                    </label>
                    <div className="flex justify-between items-center mt-1">
                      <SubmitButton tone="secondary">
                        <span lang={locale}>{locale === 'ta' ? 'குறிப்புகளைச் சேமிக்க' : 'Save captions'}</span>
                      </SubmitButton>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-1 border-t border-line pt-2 text-xs">
                    <p className="font-medium">{photo.captionEn || '—'}</p>
                    <p lang="ta" className="text-muted">
                      {photo.captionTa || '—'}
                    </p>
                  </div>
                )}

                {isDraft ? (
                  <form action={deletePhoto} className="flex justify-end">
                    <input type="hidden" name="albumId" value={album.id} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <SubmitButton tone="danger">
                      <span lang={locale}>{locale === 'ta' ? 'புகைப்படத்தை நீக்குக' : 'Delete photo'}</span>
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Submission & Publication Lifecycle Controls */}
      {isDraft ? (
        <section aria-labelledby="submit-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="submit-heading" className="text-base font-bold text-text">
              <span lang={locale}>{locale === 'ta' ? 'வெளியீட்டிற்காகத் தொகுப்பைச் சமர்ப்பித்தல்' : 'Submit album for publication'}</span>
            </h2>
            <p className="text-xs text-muted">
              {locale === 'ta'
                ? 'சமர்ப்பிக்க இருமொழிச் சுருக்கம் மற்றும் பதிவேற்றிய அனைத்து புகைப்படங்களுக்கும் இருமொழிக் குறிப்புகள் தேவை.'
                : 'Submission requires a bilingual summary and both English and Tamil captions on every uploaded photo.'}
            </p>
          </div>

          <form action={submitAlbum} className="flex justify-end">
            <input type="hidden" name="albumId" value={album.id} />
            <SubmitButton tone="primary">
              <span lang={locale}>{locale === 'ta' ? 'ஆய்வுக்காகச் சமர்ப்பிக்க' : 'Submit album for review'}</span>
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {isSubmitted ? (
        <section aria-labelledby="approval-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="approval-heading" className="text-base font-bold text-text">
              <span lang={locale}>{locale === 'ta' ? 'ஆய்வு மற்றும் வெளியீட்டு முடிவு' : 'Review and publication decision'}</span>
            </h2>
            <p className="text-xs text-muted">
              {locale === 'ta'
                ? 'கடமைப் பிரிப்பு விதிகளின்படி, சமர்ப்பித்த பணியாளர் இத்தொகுப்பை வெளியிட முடியாது.'
                : 'Per separation-of-duties rules, an album cannot be published by the staff member who submitted it.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <form action={returnAlbum} className="flex flex-1 flex-col gap-2 sm:max-w-md">
              <input type="hidden" name="albumId" value={album.id} />
              <label className="flex flex-col gap-1 text-xs font-semibold">
                <span lang={locale}>{locale === 'ta' ? 'குறிப்புடன் வரைவுக்குத் திருப்புக' : 'Return to draft with note'}</span>
                <input
                  name="note"
                  required
                  minLength={3}
                  maxLength={1000}
                  placeholder={locale === 'ta' ? 'திருத்தப்பட வேண்டியதை விவரிக்கவும்...' : 'Explain what needs correction...'}
                  className="rounded border border-line px-3 py-1.5 text-xs"
                />
              </label>
              <div className="flex justify-start">
                <SubmitButton tone="secondary">
                  <span lang={locale}>{locale === 'ta' ? 'வரைவுக்குத் திருப்புக' : 'Return to draft'}</span>
                </SubmitButton>
              </div>
            </form>

            <form action={publishAlbum} className="flex flex-col gap-2">
              <input type="hidden" name="albumId" value={album.id} />
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" name="confirmPublish" value="1" required />
                <span>
                  {locale === 'ta'
                    ? 'இத்தொகுப்பு சரிபார்க்கப்பட்டு பொது பார்வைக்குத் தயார் என்பதை உறுதிப்படுத்துகிறேன்.'
                    : 'I confirm this album is verified and ready for public display.'}
                </span>
              </label>
              <div className="flex justify-end">
                <SubmitButton tone="primary">
                  <span lang={locale}>{locale === 'ta' ? 'தொகுப்பை வெளியிடுக' : 'Publish album'}</span>
                </SubmitButton>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {isPublished ? (
        <div className="rounded-xl border border-success bg-success-bg p-4 text-xs font-medium text-success">
          {locale === 'ta'
            ? `✓ இத்தொகுப்பு வெளியிடப்பட்டு உறுப்பினர்கள் காட்சியகத்தில் தென்படுகிறது. வெளியிடப்பட்ட நேரம்: ${formatDateTime(album.publishedAt)}`
            : `✓ This album is published and visible in the member gallery. Published on ${formatDateTime(album.publishedAt)}.`}
        </div>
      ) : null}
    </>
  );
}
