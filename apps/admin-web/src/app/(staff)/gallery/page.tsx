import type { AlbumSummary, QueuedRemoval } from '@my-people/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { decideRemoval } from '@/features/gallery/actions';
import { formatDate, formatDateTime } from '@/lib/format';
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function GalleryPage(props: PageProps<'/gallery'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading gallery console</p>}>
      <GalleryContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function GalleryContent({ searchParams }: { searchParams: PageProps<'/gallery'>['searchParams'] }) {
  const staff = await requireStaff();
  const params = await searchParams;

  const canPublish = staff.permissions.has('gallery.publish');
  const canTakeDown = staff.permissions.has('gallery.takedown');

  if (!canPublish && !canTakeDown) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader ta="புகைப்படத் தொகுப்பு & நீக்கங்கள்" en="Gallery console" />
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-error">
          ! You do not have permission to view gallery albums (gallery.publish) or removal requests (gallery.takedown).
        </p>
      </div>
    );
  }

  const requestedTab = one(params.tab);
  let tab: 'albums' | 'removals';
  if (requestedTab === 'removals' && canTakeDown) {
    tab = 'removals';
  } else if (requestedTab === 'albums' && canPublish) {
    tab = 'albums';
  } else if (canTakeDown && !canPublish) {
    tab = 'removals';
  } else {
    tab = 'albums';
  }

  return (
    <>
      <PageHeader ta="புகைப்படத் தொகுப்பு & நீக்கங்கள்" en="Gallery console">
        {canPublish && tab === 'albums' ? (
          <Link
            href="/gallery/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90">
            <span className="flex flex-col items-center">
              <span lang="ta">+ புதிய தொகுப்பு</span>
              <span lang="en" className="text-xs font-normal opacity-90">+ Create album</span>
            </span>
          </Link>
        ) : null}
      </PageHeader>

      {/* Tabs navigation */}
      <nav aria-label="Gallery sections" className="flex border-b border-line text-sm font-semibold">
        {canPublish ? (
          <Link
            href="/gallery?tab=albums"
            className={`border-b-2 px-4 py-3 ${tab === 'albums' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}>
            <span className="flex flex-col items-center">
              <span lang="ta">புகைப்படத் தொகுப்புகள்</span>
              <span lang="en" className="text-xs font-normal opacity-90">Albums management</span>
            </span>
          </Link>
        ) : null}
        {canTakeDown ? (
          <Link
            href="/gallery?tab=removals"
            className={`border-b-2 px-4 py-3 ${tab === 'removals' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}>
            <span className="flex flex-col items-center">
              <span lang="ta">நீக்கல் கோரிக்கைகள் (24 மணி)</span>
              <span lang="en" className="text-xs font-normal opacity-90">Photo removal queue (24h)</span>
            </span>
          </Link>
        ) : null}
      </nav>

      <Suspense fallback={<p className="text-muted">… Loading gallery console</p>}>
        {tab === 'removals' ? (
          <RemovalsQueueContent searchParams={searchParams} />
        ) : (
          <AlbumsContent searchParams={searchParams} />
        )}
      </Suspense>
    </>
  );
}

async function AlbumsContent({ searchParams }: { searchParams: PageProps<'/gallery'>['searchParams'] }) {
  const params = await searchParams;
  const state = one(params.state) as 'draft' | 'submitted' | 'published' | undefined;
  const error = one(params.error);
  const problems = one(params.problems);
  const done = one(params.done);

  const api = await staffApi();
  let albums: AlbumSummary[] = [];

  try {
    const states = state ? [state] : (['draft', 'submitted', 'published'] as const);
    albums = await api.listManagedAlbums({ states, limit: 100 });
  } catch (err) {
    if (isRefusal(err)) return <p className="text-error">! {messageFor(err.code)}</p>;
    throw err;
  }

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          State filter
          <select name="state" defaultValue={state ?? ''} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
            <option value="">All active states</option>
            <option value="draft">Drafts</option>
            <option value="submitted">Submitted for approval</option>
            <option value="published">Published</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          Filter
        </button>
      </form>

      {albums.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          No albums found matching your area and filter.
        </div>
      ) : null}

      <div hidden={albums.length === 0} className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Managed albums</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Cover</th>
              <th scope="col" className="px-3 py-2">Reference</th>
              <th scope="col" className="px-3 py-2">Title</th>
              <th scope="col" className="px-3 py-2">Category</th>
              <th scope="col" className="px-3 py-2">Place & Date</th>
              <th scope="col" className="px-3 py-2">Photos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {albums.map((album) => (
              <tr key={album.id} className="hover:bg-surface/50">
                <td className="px-3 py-2">
                  {album.coverPhotoId ? (
                    <Image
                      src={`/evidence/photo/${album.coverPhotoId}/thumb`}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 rounded object-cover border border-line bg-surface"
                      unoptimized
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded border border-line bg-surface text-xs text-muted">
                      No cover
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono">
                  <Link href={`/gallery/albums/${album.id}`} className="font-semibold text-primary underline">
                    {album.albumRef}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium">{album.titleEn}</p>
                  <p lang="ta" className="text-xs text-muted">
                    {album.titleTa}
                  </p>
                </td>
                <td className="px-3 py-2 capitalize">{album.category}</td>
                <td className="px-3 py-2 text-muted">
                  <p>{album.place || '—'}</p>
                  <p className="text-xs">{formatDate(album.albumDate)}</p>
                </td>
                <td className="px-3 py-2 font-medium">{album.photoCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function RemovalsQueueContent({ searchParams }: { searchParams: PageProps<'/gallery'>['searchParams'] }) {
  const params = await searchParams;
  const state = one(params.state) as 'open' | 'removed' | 'blurred' | 'kept' | undefined;
  const error = one(params.error);
  const problems = one(params.problems);
  const done = one(params.done);
  const api = await staffApi();
  let requests: QueuedRemoval[] = [];

  try {
    const states = state ? [state] : (['open'] as const);
    requests = await api.listRemovalRequests({ states, limit: 100 });
  } catch (err) {
    if (isRefusal(err)) return <p className="text-error">! {messageFor(err.code)}</p>;
    throw err;
  }

  const escalatedCount = requests.filter((r) => r.escalated).length;

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>{requests.length} open removal requests in your area</p>
        {escalatedCount > 0 ? (
          <span className="rounded bg-error-bg px-2.5 py-1 text-xs font-semibold text-error">
            ! {escalatedCount} requests open 18+ hours (escalated)
          </span>
        ) : null}
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <input type="hidden" name="tab" value="removals" />
        <label className="flex flex-col gap-1 text-sm font-semibold">
          State filter
          <select name="state" defaultValue={state ?? 'open'} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
            <option value="open">Open (awaiting decision)</option>
            <option value="removed">Removed</option>
            <option value="blurred">Blurred</option>
            <option value="kept">Kept (declined removal)</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          Filter
        </button>
      </form>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          ✓ All caught up. No photo removal requests currently awaiting action in your area.
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {requests.map((req) => (
          <article
            key={req.id}
            className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row ${
              req.escalated ? 'border-error/60 bg-error-bg/10' : 'border-line bg-card'
            }`}>
            {/* Safe photo preview */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <Image
                src={`/evidence/photo/${req.photoId}/thumb`}
                alt="Protected photo evidence"
                width={128}
                height={128}
                className="size-32 rounded-lg object-cover border border-line bg-surface"
                unoptimized
              />
              <span className="text-xs text-muted">Protected preview</span>
            </div>

            {/* Request context */}
            <div className="flex flex-1 flex-col justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold">{req.requestRef}</span>
                  <StateTag state={req.state} />
                  {req.escalated ? (
                    <span className="rounded bg-error-bg px-2 py-0.5 text-xs font-bold text-error">
                      ! 18h Escalated
                    </span>
                  ) : null}
                  <span className="text-xs text-muted">Album: {req.albumRef}</span>
                </div>

                <p className="text-sm">
                  <span className="font-semibold">Reason:</span> {req.reason.replace(/_/g, ' ')}
                </p>

                {req.note ? (
                  <p className="rounded bg-surface p-2 text-xs italic text-muted">
                    &ldquo;{req.note}&rdquo;
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-4 text-xs text-muted">
                  <span>Source: {req.fromMember ? 'Registered member' : `Public (${req.contact ?? 'anonymous'})`}</span>
                  <span>Submitted: {formatDateTime(req.createdAt)}</span>
                  <span>Due within 24h: {formatDateTime(req.dueAt)}</span>
                </div>
              </div>

              {/* Decision action form if open */}
              {req.state === 'open' ? (
                <form action={decideRemoval} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
                  <input type="hidden" name="requestId" value={req.id} />
                  <div>
                    <span lang="ta" className="block text-xs font-semibold text-muted">நீக்கல் கோரிக்கை முடிவு *</span>
                    <span lang="en" className="block text-xs font-semibold">Moderation decision (required):</span>
                  </div>

                  <fieldset id="input-decision" className="flex flex-wrap items-center gap-4">
                    <legend className="sr-only">Moderation decision</legend>
                    <label className="flex items-start gap-1.5 text-xs font-medium">
                      <input
                        type="radio"
                        name="decision"
                        value="remove"
                        required
                        className="mt-0.5"
                      />
                      <span className="flex flex-col">
                        <span lang="ta" className="font-semibold text-text">புகைப்படத்தை நீக்குக</span>
                        <span lang="en" className="text-[11px] text-muted">Remove photo</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-1.5 text-xs font-medium">
                      <input
                        type="radio"
                        name="decision"
                        value="blur"
                        required
                        className="mt-0.5"
                      />
                      <span className="flex flex-col">
                        <span lang="ta" className="font-semibold text-text">புகைப்படத்தை மங்கலாக்குக</span>
                        <span lang="en" className="text-[11px] text-muted">Blur photo</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-1.5 text-xs font-medium">
                      <input
                        type="radio"
                        name="decision"
                        value="keep"
                        required
                        className="mt-0.5"
                      />
                      <span className="flex flex-col">
                        <span lang="ta" className="font-semibold text-text">தக்கவைத்துக்கொள்க</span>
                        <span lang="en" className="text-[11px] text-muted">Keep photo</span>
                      </span>
                    </label>
                  </fieldset>

                  <label htmlFor="input-reason" className="flex flex-col gap-1 text-xs font-semibold">
                    <span lang="ta" className="text-xs text-muted">தீர்மான நியாயப்படுத்தல் / தணிக்கைக் காரணம் *</span>
                    <span lang="en" className="text-xs">Decision rationale / audit reason *</span>
                    <input
                      id="input-reason"
                      name="reason"
                      required
                      minLength={3}
                      maxLength={1000}
                      placeholder="Explain justification for audit trail and notification to requester..."
                      className="min-h-9 rounded border border-line px-3 text-xs"
                    />
                  </label>

                  <label className="flex items-start gap-2 text-xs font-medium text-muted">
                    <input
                      type="checkbox"
                      id="input-confirm"
                      name="confirmRemoval"
                      value="1"
                      required
                      className="mt-0.5 rounded border-line"
                    />
                    <span>
                      <span lang="ta" className="block font-semibold text-text">
                        இப்பட நீக்கல் கோரிக்கைத் தீர்மானத்தை உறுதிப்படுத்துகிறேன்.
                      </span>
                      <span lang="en" className="block text-muted">
                        I confirm this photo removal moderation decision.
                      </span>
                    </span>
                  </label>

                  <div className="flex justify-end">
                    <SubmitButton tone="primary">
                      <span className="flex flex-col items-center">
                        <span lang="ta">முடிவைப் பதிவுசெய்க</span>
                        <span lang="en" className="text-xs font-normal opacity-90">Record decision</span>
                      </span>
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-muted">
                  Decided: {req.decisionReason ?? 'No reason recorded'} on {formatDateTime(req.decidedAt)}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
