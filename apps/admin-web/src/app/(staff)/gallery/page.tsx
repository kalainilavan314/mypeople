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
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
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
  const locale = await getAdminLocale(staff.member.language);
  const params = await searchParams;

  const canPublish = staff.permissions.has('gallery.publish');
  const canTakeDown = staff.permissions.has('gallery.takedown');

  if (!canPublish && !canTakeDown) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader ta="புகைப்படத் தொகுப்பு & நீக்கங்கள்" en="Gallery console" />
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-error">
          ! {locale === 'ta'
            ? 'படத்தொகுப்புகளையோ (gallery.publish) அல்லது நீக்கக் கோரிக்கைகளையோ (gallery.takedown) பார்வையிட உங்களுக்கு அனுமதி இல்லை.'
            : 'You do not have permission to view gallery albums (gallery.publish) or removal requests (gallery.takedown).'}
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
            <span lang={locale}>{locale === 'ta' ? '+ புதிய தொகுப்பு' : '+ Create album'}</span>
          </Link>
        ) : null}
      </PageHeader>

      {/* Tabs navigation */}
      <nav aria-label="Gallery sections" className="flex border-b border-line text-sm font-semibold">
        {canPublish ? (
          <Link
            href="/gallery?tab=albums"
            className={`border-b-2 px-4 py-3 ${tab === 'albums' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}>
            <span lang={locale}>{locale === 'ta' ? 'புகைப்படத் தொகுப்புகள்' : 'Albums management'}</span>
          </Link>
        ) : null}
        {canTakeDown ? (
          <Link
            href="/gallery?tab=removals"
            className={`border-b-2 px-4 py-3 ${tab === 'removals' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}>
            <span lang={locale}>{locale === 'ta' ? 'நீக்கல் கோரிக்கைகள் (24 மணி)' : 'Photo removal queue (24h)'}</span>
          </Link>
        ) : null}
      </nav>

      <Suspense fallback={<p className="text-muted">… {locale === 'ta' ? 'ஏற்றப்படுகிறது' : 'Loading'}</p>}>
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
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
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
    if (isRefusal(err)) return <p className="text-error">! {getLocalizedMessage(err.code, locale)}</p>;
    throw err;
  }

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'நிலை வடிகட்டி' : 'State filter'}</span>
          <select name="state" defaultValue={state ?? ''} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
            <option value="">{locale === 'ta' ? 'அனைத்து நிலைகளும்' : 'All active states'}</option>
            <option value="draft">{locale === 'ta' ? 'வரைவுகள்' : 'Drafts'}</option>
            <option value="submitted">{locale === 'ta' ? 'ஒப்புதலுக்குச் சமர்ப்பிக்கப்பட்டவை' : 'Submitted for approval'}</option>
            <option value="published">{locale === 'ta' ? 'வெளியிடப்பட்டவை' : 'Published'}</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          <span lang={locale}>{locale === 'ta' ? 'வடிகட்டுக' : 'Filter'}</span>
        </button>
      </form>

      {albums.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          <span lang={locale}>{locale === 'ta' ? 'உங்கள் பகுதிக்கு எந்தத் தொகுப்புகளும் காணப்படவில்லை.' : 'No albums found matching your area and filter.'}</span>
        </div>
      ) : null}

      <div hidden={albums.length === 0} className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Managed albums</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'அட்டைப்படம்' : 'Cover'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'குறிப்பு எண்' : 'Reference'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'தலைப்பு' : 'Title'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'வகை' : 'Category'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'இடம் & திகதி' : 'Place & Date'}</th>
              <th scope="col" className="px-3 py-2 font-semibold text-text">{locale === 'ta' ? 'படங்கள்' : 'Photos'}</th>
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
                      {locale === 'ta' ? 'அட்டை இல்லை' : 'No cover'}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono">
                  <Link href={`/gallery/albums/${album.id}`} className="font-semibold text-primary underline">
                    {album.albumRef}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-text">{locale === 'ta' ? album.titleTa || album.titleEn : album.titleEn || album.titleTa}</p>
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
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
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
    if (isRefusal(err)) return <p className="text-error">! {getLocalizedMessage(err.code, locale)}</p>;
    throw err;
  }

  const escalatedCount = requests.filter((r) => r.escalated).length;

  return (
    <>
      <Feedback error={error} problems={problems} done={done} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>
          {locale === 'ta'
            ? `உங்கள் பகுதியில் ${requests.length} திறந்த நீக்கல் கோரிக்கைகள் உள்ளன`
            : `${requests.length} open removal requests in your area`}
        </p>
        {escalatedCount > 0 ? (
          <span className="rounded bg-error-bg px-2.5 py-1 text-xs font-semibold text-error">
            ! {locale === 'ta' ? `${escalatedCount} கோரிக்கைகள் 18 மணி நேரத்திற்கு மேலாகத் திறக்கப்பட்டுள்ளன` : `${escalatedCount} requests open 18+ hours (escalated)`}
          </span>
        ) : null}
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3" role="search">
        <input type="hidden" name="tab" value="removals" />
        <label className="flex flex-col gap-1 text-sm font-semibold text-text">
          <span lang={locale}>{locale === 'ta' ? 'நிலை வடிகட்டி' : 'State filter'}</span>
          <select name="state" defaultValue={state ?? 'open'} className="min-h-11 rounded-lg border border-line px-3 bg-surface">
            <option value="open">{locale === 'ta' ? 'திறந்தவை (முடிவுக்காகக் காத்திருப்பவை)' : 'Open (awaiting decision)'}</option>
            <option value="removed">{locale === 'ta' ? 'நீக்கப்பட்டவை' : 'Removed'}</option>
            <option value="blurred">{locale === 'ta' ? 'மங்கலாக்கப்பட்டவை' : 'Blurred'}</option>
            <option value="kept">{locale === 'ta' ? 'தக்கவைக்கப்பட்டவை (நிராகரிக்கப்பட்ட கோரிக்கைகள்)' : 'Kept (declined removal)'}</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          <span lang={locale}>{locale === 'ta' ? 'வடிகட்டுக' : 'Filter'}</span>
        </button>
      </form>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          {locale === 'ta' ? 'உங்கள் பகுதியில் நிலுவையில் உள்ள நீக்கல் கோரிக்கைகள் எதுவும் இல்லை.' : 'All caught up. No photo removal requests currently awaiting action in your area.'}
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
              <span className="text-xs text-muted">{locale === 'ta' ? 'பாதுகாக்கப்பட்ட முன்னோட்டம்' : 'Protected preview'}</span>
            </div>

            {/* Request context */}
            <div className="flex flex-1 flex-col justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold">{req.requestRef}</span>
                  <StateTag state={req.state} />
                  {req.escalated ? (
                    <span className="rounded bg-error-bg px-2 py-0.5 text-xs font-bold text-error">
                      ! {locale === 'ta' ? '18+ மணி அவசரம்' : '18h Escalated'}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted">{locale === 'ta' ? 'தொகுப்பு:' : 'Album:'} {req.albumRef}</span>
                </div>

                <p className="text-sm">
                  <span className="font-semibold text-text">{locale === 'ta' ? 'காரணம்:' : 'Reason:'}</span> {req.reason.replace(/_/g, ' ')}
                </p>

                {req.note ? (
                  <p className="rounded bg-surface p-2 text-xs italic text-muted">
                    &ldquo;{req.note}&rdquo;
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-4 text-xs text-muted">
                  <span>{locale === 'ta' ? 'மூலம்:' : 'Source:'} {req.fromMember ? (locale === 'ta' ? 'பதிவுசெய்த உறுப்பினர்' : 'Registered member') : (locale === 'ta' ? `பொதுமகன் (${req.contact ?? 'பெயரற்றவர்'})` : `Public (${req.contact ?? 'anonymous'})`)}</span>
                  <span>{locale === 'ta' ? 'சமர்ப்பிக்கப்பட்டது:' : 'Submitted:'} {formatDateTime(req.createdAt)}</span>
                  <span>{locale === 'ta' ? '24 மணி நேரத்திற்குள்:' : 'Due within 24h:'} {formatDateTime(req.dueAt)}</span>
                </div>
              </div>

              {/* Decision action form if open */}
              {req.state === 'open' ? (
                <form action={decideRemoval} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
                  <input type="hidden" name="requestId" value={req.id} />
                  <div>
                    <span lang={locale} className="block text-xs font-semibold text-text">
                      {locale === 'ta' ? 'நீக்கல் கோரிக்கை முடிவு *' : 'Moderation decision (required):'}
                    </span>
                  </div>

                  <fieldset id="input-decision" className="flex flex-wrap items-center gap-4">
                    <legend className="sr-only">Moderation decision</legend>
                    <label className="flex items-center gap-1.5 text-xs font-medium">
                      <input
                        type="radio"
                        name="decision"
                        value="remove"
                        required
                      />
                      <span lang={locale} className="font-semibold text-text">
                        {locale === 'ta' ? 'புகைப்படத்தை நீக்குக' : 'Remove photo'}
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-medium">
                      <input
                        type="radio"
                        name="decision"
                        value="blur"
                        required
                      />
                      <span lang={locale} className="font-semibold text-text">
                        {locale === 'ta' ? 'புகைப்படத்தை மங்கலாக்குக' : 'Blur photo'}
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-medium">
                      <input
                        type="radio"
                        name="decision"
                        value="keep"
                        required
                      />
                      <span lang={locale} className="font-semibold text-text">
                        {locale === 'ta' ? 'தக்கவைத்துக்கொள்க' : 'Keep photo'}
                      </span>
                    </label>
                  </fieldset>

                  <label htmlFor="input-reason" className="flex flex-col gap-1 text-xs font-semibold text-text">
                    <span lang={locale}>
                      {locale === 'ta' ? 'தீர்மான நியாயப்படுத்தல் / தணிக்கைக் காரணம் *' : 'Decision rationale / audit reason *'}
                    </span>
                    <input
                      id="input-reason"
                      name="reason"
                      required
                      minLength={3}
                      maxLength={1000}
                      placeholder={locale === 'ta' ? 'தணிக்கை மற்றும் கோரிக்கையாளருக்கான காரணத்தை விளக்குக...' : 'Explain justification for audit trail...'}
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
                    <span lang={locale} className="font-semibold text-text">
                      {locale === 'ta'
                        ? 'இப்பட நீக்கல் கோரிக்கைத் தீர்மானத்தை உறுதிப்படுத்துகிறேன்.'
                        : 'I confirm this photo removal moderation decision.'}
                    </span>
                  </label>

                  <div className="flex justify-end">
                    <SubmitButton tone="primary">
                      <span lang={locale}>{locale === 'ta' ? 'முடிவைப் பதிவுசெய்க' : 'Record decision'}</span>
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-muted">
                  {locale === 'ta' ? 'தீர்மானிக்கப்பட்டது:' : 'Decided:'} {req.decisionReason ?? (locale === 'ta' ? 'காரணம் பதியப்படவில்லை' : 'No reason recorded')} {locale === 'ta' ? 'அன்று:' : 'on'} {formatDateTime(req.decidedAt)}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
