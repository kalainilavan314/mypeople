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
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

export default function AlbumDetailPage(props: PageProps<'/gallery/albums/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading album</p>}>
      <AlbumDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function AlbumDetail({ params, searchParams }: Pick<PageProps<'/gallery/albums/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params;
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const problems = Array.isArray(query.problems) ? query.problems[0] : query.problems;
  const done = Array.isArray(query.done) ? query.done[0] : query.done;

  const api = await staffApi();
  let album: ManagedAlbum;

  try {
    album = await api.getManagedAlbum(id);
  } catch (err) {
    if (isRefusal(err)) {
      return (
        <div className="flex flex-col gap-4">
          <Link href="/gallery" className="text-sm font-semibold text-primary underline">
            ← Back to gallery
          </Link>
          <p className="text-error">! {messageFor(err.code)}</p>
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
          ← Back to gallery console
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted">{album.albumRef}</span>
            <StateTag state={album.state} />
          </div>
          <p lang="ta" className="text-sm font-semibold text-muted">
            {album.titleTa}
          </p>
          <h1 className="text-2xl font-bold">{album.titleEn}</h1>
          <p className="text-xs text-muted">
            Category: {album.category} · Publisher: {album.publisher} · Date: {formatDate(album.albumDate)}
          </p>
        </div>
      </header>

      <Feedback error={error} problems={problems} done={done} />

      {album.returnNote ? (
        <section aria-labelledby="return-note" className="rounded-xl border border-warning bg-warning-bg p-4 text-warning">
          <h2 id="return-note" className="font-bold">
            ! Returned to draft
          </h2>
          <p className="mt-1 text-sm">{album.returnNote}</p>
        </section>
      ) : null}

      {/* Album Summary Section */}
      <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-line bg-card p-6">
        <div>
          <span className="text-xs font-semibold text-muted">Summary (English)</span>
          <p className="mt-1 text-sm">{album.summaryEn || '—'}</p>
        </div>
        <div>
          <span className="text-xs font-semibold text-muted">Summary (Tamil / தமிழ்)</span>
          <p lang="ta" className="mt-1 text-sm">
            {album.summaryTa || '—'}
          </p>
        </div>
      </div>

      {/* Photos Management */}
      <section aria-labelledby="photos-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
          <h2 id="photos-heading" className="text-base font-bold">
            Photos ({album.photos.length})
          </h2>
          <span className="text-xs text-muted">
            {isDraft ? 'WebP conversion on upload removes all EXIF and GPS coordinates.' : 'Published photos'}
          </span>
        </div>

        {/* Upload form for drafts */}
        {isDraft ? (
          <form action={uploadPhoto} className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4">
            <input type="hidden" name="albumId" value={album.id} />
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Add photo (JPEG, PNG or WebP, up to 15MB)
              <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="text-xs" />
            </label>
            <SubmitButton tone="secondary">Upload photo</SubmitButton>
          </form>
        ) : null}

        {album.photos.length === 0 ? (
          <p className="text-sm text-muted">No photos in this album yet.</p>
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
                    <span className="font-mono font-bold text-foreground">Photo #{photo.number}</span>
                    <span>
                      {photo.width} × {photo.height} px
                    </span>
                    {photo.blurred ? <span className="font-semibold text-warning">Blurred</span> : null}
                  </div>
                </div>

                {isDraft ? (
                  <form action={updatePhotoCaptions} className="flex flex-col gap-2 border-t border-line pt-2">
                    <input type="hidden" name="albumId" value={album.id} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <label className="flex flex-col gap-0.5 text-xs font-semibold">
                      Caption (English)
                      <input
                        name="captionEn"
                        defaultValue={photo.captionEn}
                        maxLength={500}
                        placeholder="English caption..."
                        className="rounded border border-line px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-xs font-semibold">
                      Caption (Tamil / தமிழ்) *
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
                      <SubmitButton tone="secondary">Save captions</SubmitButton>
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
                    <SubmitButton tone="danger">Delete photo</SubmitButton>
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
            <h2 id="submit-heading" className="text-base font-bold">
              Submit album for publication
            </h2>
            <p className="text-xs text-muted">
              Submission requires a bilingual summary and both English and Tamil captions on every uploaded photo.
            </p>
          </div>

          <form action={submitAlbum} className="flex justify-end">
            <input type="hidden" name="albumId" value={album.id} />
            <SubmitButton tone="primary">Submit album for review</SubmitButton>
          </form>
        </section>
      ) : null}

      {isSubmitted ? (
        <section aria-labelledby="approval-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="approval-heading" className="text-base font-bold">
              Review and publication decision
            </h2>
            <p className="text-xs text-muted">
              Per separation-of-duties rules, an album cannot be published by the staff member who submitted it.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <form action={returnAlbum} className="flex flex-1 flex-col gap-2 sm:max-w-md">
              <input type="hidden" name="albumId" value={album.id} />
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Return to draft with note
                <input
                  name="note"
                  required
                  minLength={3}
                  maxLength={1000}
                  placeholder="Explain what needs correction..."
                  className="rounded border border-line px-3 py-1.5 text-xs"
                />
              </label>
              <div className="flex justify-start">
                <SubmitButton tone="secondary">Return to draft</SubmitButton>
              </div>
            </form>

            <form action={publishAlbum} className="flex flex-col gap-2">
              <input type="hidden" name="albumId" value={album.id} />
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" name="confirmPublish" value="1" required />
                <span>I confirm this album is verified and ready for public display.</span>
              </label>
              <div className="flex justify-end">
                <SubmitButton tone="primary">Publish album</SubmitButton>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {isPublished ? (
        <div className="rounded-xl border border-success bg-success-bg p-4 text-xs font-medium text-success">
          ✓ This album is published and visible in the member gallery. Published on {formatDateTime(album.publishedAt)}.
        </div>
      ) : null}
    </>
  );
}
