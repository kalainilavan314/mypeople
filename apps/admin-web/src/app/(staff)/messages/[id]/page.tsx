import type { BroadcastPreview } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import {
  approveBroadcast,
  cancelBroadcast,
  submitBroadcast,
  updateBroadcast,
} from '@/features/messages/actions';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage, getLocalizedProblem } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

export default function BroadcastDetailPage(props: PageProps<'/messages/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading broadcast</p>}>
      <BroadcastDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function BroadcastDetail({ params, searchParams }: Pick<PageProps<'/messages/[id]'>, 'params' | 'searchParams'>) {
  const staff = await requireStaff();
  const { id } = await params;
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const problems = Array.isArray(query.problems) ? query.problems[0] : query.problems;
  const done = Array.isArray(query.done) ? query.done[0] : query.done;

  const locale = await getAdminLocale(staff.member.language);
  const api = await staffApi();
  let preview: BroadcastPreview;

  try {
    preview = await api.previewBroadcast(id);
  } catch (err) {
    if (isRefusal(err)) {
      return (
        <div className="flex flex-col gap-4">
          <Link href="/messages" className="text-sm font-semibold text-primary underline">
            <span lang={locale}>{locale === 'ta' ? '← அறிவித்தல்களுக்குத் திரும்புக' : '← Back to broadcasts'}</span>
          </Link>
          <p className="text-error">! {getLocalizedMessage(err.code, locale)}</p>
        </div>
      );
    }
    throw err;
  }

  const isDraft = preview.state === 'draft';
  const isPending = preview.state === 'pending_approval';
  const isScheduled = preview.state === 'scheduled';
  const isSent = preview.state === 'sent';
  const isCancelled = preview.state === 'cancelled';

  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/messages" className="text-sm font-semibold text-primary underline">
          <span lang={locale}>{locale === 'ta' ? '← அறிவித்தல்களுக்குத் திரும்புக' : '← Back to broadcasts'}</span>
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted">{preview.broadcastRef}</span>
            <StateTag state={preview.state} />
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                preview.topic === 'emergency' ? 'bg-error-bg text-error' : 'bg-surface text-muted'
              }`}>
              {preview.topic === 'emergency' ? (locale === 'ta' ? 'அவசரம்' : 'emergency') : (locale === 'ta' ? 'அறிவித்தல்' : preview.topic)}
            </span>
          </div>
          <h1 lang={locale} className="text-2xl font-bold text-text">
            {locale === 'ta' ? preview.titleTa || preview.titleEn : preview.titleEn || preview.titleTa}
          </h1>
          <p className="text-xs text-muted">
            {locale === 'ta' ? 'இலக்குப் பகுதி:' : 'Target audience:'} {areaText(preview.areaKey)}
          </p>
        </div>
      </header>

      <Feedback error={error} problems={problems} done={done} />

      {/* Recipient Reach & Scope Estimate */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">{locale === 'ta' ? 'மதிப்பிடப்பட்ட பெறுநர்கள்' : 'Audience estimate'}</span>
          <p className="mt-1 text-2xl font-bold">{preview.reaches.toLocaleString()}</p>
          <p className="text-xs text-muted">
            {locale === 'ta' ? `${areaText(preview.areaKey)} பகுதியில் உள்ள உறுப்பினர்கள்` : `active members in ${areaText(preview.areaKey)}`}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">{locale === 'ta' ? 'இரண்டாம் நபர் ஒப்புதல்' : 'Second-person approval'}</span>
          <p className="mt-1 font-semibold">
            {preview.needsApproval
              ? (locale === 'ta' ? 'தேவைப்படுகிறது (நிலை 4 அல்லது 5)' : 'Required (Tier 4 or 5)')
              : (locale === 'ta' ? 'தேவையில்லை (உள்ளூர்ப் பகுதி)' : 'Not required (Local area)')}
          </p>
          <p className="text-xs text-muted">
            {preview.needsApproval
              ? (locale === 'ta' ? 'மாவட்டத்தை விட விரிவான பகுதிக்கு உயர்நிலை ஒப்புதல் அவசியம்' : 'Scope wider than district requires senior approval')
              : (locale === 'ta' ? 'மாவட்டம் அல்லது கோட்ட எல்லைக்குள்' : 'District or division scope')}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">{locale === 'ta' ? 'நிலை' : 'Status'}</span>
          <p className="mt-1 font-semibold capitalize">
            {locale === 'ta'
              ? (preview.state === 'draft' ? 'வரைவு' : preview.state === 'pending_approval' ? 'ஒப்புதலுக்காகக் காத்திருக்கிறது' : preview.state === 'scheduled' ? 'திட்டமிடப்பட்டது' : preview.state === 'sent' ? 'அனுப்பப்பட்டது' : 'இரத்து செய்யப்பட்டது')
              : preview.state.replace(/_/g, ' ')}
          </p>
          <p className="text-xs text-muted">
            {isSent && preview.sentAt ? (locale === 'ta' ? `அனுப்பப்பட்டது: ${formatDateTime(preview.sentAt)}` : `Dispatched ${formatDateTime(preview.sentAt)}`) : ''}
            {isScheduled && preview.sendAt ? (locale === 'ta' ? `வரிசைப்படுத்தப்பட்டுள்ளது: ${formatDateTime(preview.sendAt)}` : `Queued for dispatch at/after ${formatDateTime(preview.sendAt)}`) : ''}
            {isCancelled ? (locale === 'ta' ? 'அனுப்புவதிலிருந்து திரும்பப் பெறப்பட்டது' : 'Withdrawn from dispatch') : ''}
            {isDraft ? (locale === 'ta' ? 'தயாரிப்பில் உள்ளது' : 'In preparation') : ''}
          </p>
        </div>
      </div>

      {isScheduled ? (
        <section aria-labelledby="scheduled-banner" className="rounded-xl border border-primary/40 bg-surface p-4 text-xs">
          <h2 id="scheduled-banner" className="font-bold text-primary">
            {locale === 'ta' ? 'பின்புலப் பணியாளரால் அனுப்ப வரிசைப்படுத்தப்பட்டுள்ளது' : 'Queued for background worker dispatch'}
          </h2>
          <p className="mt-1 text-muted">
            {locale === 'ta'
              ? `இந்த அறிவித்தல் ${formatDateTime(preview.sendAt)} அன்று அல்லது அதன் பின்னர் அனுப்பப்பட வரிசைப்படுத்தப்பட்டுள்ளது.`
              : `This broadcast is queued for dispatch at or after ${formatDateTime(preview.sendAt)}. Delivery is executed by the background notifications worker.`}
          </p>
        </section>
      ) : null}

      {preview.problems.length > 0 ? (
        <section aria-labelledby="problems-notice" className="rounded-xl border border-error bg-error-bg p-4 text-error text-sm">
          <h2 id="problems-notice" className="font-bold">
            ! {locale === 'ta' ? 'உள்ளடக்கச் சரிபார்ப்பில் சிக்கல்கள் கண்டறியப்பட்டன:' : 'Content validation issues detected:'}
          </h2>
          <ul className="mt-1 list-disc pl-5">
            {preview.problems.map((p) => (
              <li key={p}>{getLocalizedProblem(p, locale)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Content Preview Cards */}
      <section aria-labelledby="preview-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
        <h2 id="preview-heading" className="text-base font-bold border-b border-line pb-2 text-text">
          {locale === 'ta' ? 'உறுப்பினர்களுக்கான செய்தி முன்னோட்டம்' : 'Member message preview'}
        </h2>

        {/* Primary preview in active locale */}
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          <span className="text-xs font-semibold text-muted">
            {locale === 'ta' ? 'அறிவித்தல் முன்னோட்டம் (தமிழ்)' : 'Broadcast preview (English)'}
          </span>
          <p lang={locale} className="text-base font-bold">
            {locale === 'ta' ? preview.titleTa : preview.titleEn}
          </p>
          <p lang={locale} className="text-sm whitespace-pre-wrap">
            {locale === 'ta' ? preview.bodyTa : preview.bodyEn}
          </p>
        </div>

        {/* Secondary alternate language preview */}
        <details className="rounded-lg border border-line bg-surface p-3 text-xs text-muted">
          <summary className="cursor-pointer font-medium hover:text-text">
            {locale === 'ta' ? 'ஆங்கில அறிவிப்பு முன்னோட்டத்தைக் காட்டு' : 'View Tamil broadcast preview'}
          </summary>
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-xs font-semibold text-muted">
              {locale === 'ta' ? 'English broadcast' : 'தமிழ் அறிவித்தல்'}
            </span>
            <p lang={locale === 'ta' ? 'en' : 'ta'} className="text-sm font-bold text-text">
              {locale === 'ta' ? preview.titleEn : preview.titleTa}
            </p>
            <p lang={locale === 'ta' ? 'en' : 'ta'} className="text-xs whitespace-pre-wrap text-text">
              {locale === 'ta' ? preview.bodyEn : preview.bodyTa}
            </p>
          </div>
        </details>
      </section>

      {/* Lifecycle Actions */}
      {isDraft ? (
        <section aria-labelledby="send-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="send-heading" className="text-base font-bold text-text">
              {locale === 'ta' ? 'அறிவித்தலை அனுப்புதல் அல்லது திட்டமிடுதல்' : 'Dispatch or schedule broadcast'}
            </h2>
            <p className="text-xs text-muted">
              {preview.needsApproval
                ? (locale === 'ta' ? 'சமர்ப்பிப்பது இந்த அறிவித்தலை உயர்நிலை அதிகாரியின் ஒப்புதலுக்காக நகர்த்தும்.' : 'Submitting will move this broadcast to pending approval for a senior staff reviewer.')
                : (locale === 'ta' ? 'சமர்ப்பிப்பது இந்த அறிவித்தலை உடனடியாக அனுப்ப அல்லது திட்டமிட்டபடி அனுப்ப வரிசைப்படுத்தும்.' : 'Submitting will queue this broadcast for immediate sending or scheduled dispatch.')}
            </p>
          </div>

          <form action={submitBroadcast} className="flex flex-col gap-4">
            <input type="hidden" name="broadcastId" value={preview.id} />

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="sendChoice" value="now" defaultChecked />
                <span>{locale === 'ta' ? 'உடனடியாக அனுப்புக' : 'Send immediately'}</span>
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="sendChoice" value="later" />
                <span>{locale === 'ta' ? 'எதிர்கால நேரத்திற்குத் திட்டமிடுக:' : 'Schedule for future time:'}</span>
                <input type="datetime-local" name="sendAt" className="min-h-10 rounded border border-line px-2 text-xs" />
              </label>
            </div>

            <div className="rounded-lg border border-warning/50 bg-warning-bg/30 p-4">
              <label className="flex items-start gap-2 text-sm font-semibold">
                <input type="checkbox" name="confirmSend" value="1" required className="mt-0.5" />
                <span>
                  {locale === 'ta'
                    ? `இந்த அறிவித்தலில் தனிநபர் பெயர்கள், தேசிய அடையாள அட்டை (NIC) எண்கள் அல்லது ரகசியத் தகவல்கள் இல்லை என்பதையும், ${preview.reaches.toLocaleString()} உறுப்பினர்களுக்கு அனுப்பத் தயாராக உள்ளது என்பதையும் உறுதிப்படுத்துகிறேன்.`
                    : `I confirm this broadcast contains no personal names, NIC numbers, or confidential case information, and is ready for transmission to ${preview.reaches.toLocaleString()} members.`}
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <SubmitButton tone="primary">
                {preview.needsApproval
                  ? (locale === 'ta' ? 'உயர்நிலை ஒப்புதலுக்குச் சமர்ப்பிக்க' : 'Submit for senior approval')
                  : (locale === 'ta' ? 'உறுதிசெய்து அறிவித்தலை அனுப்புக' : 'Confirm & send broadcast')}
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {isPending ? (
        <section aria-labelledby="approval-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="approval-heading" className="text-base font-bold text-text">
              {locale === 'ta' ? 'உயர்நிலை பணியாளர் ஒப்புதல்' : 'Senior staff approval'}
            </h2>
            <p className="text-xs text-muted">
              {locale === 'ta'
                ? 'இவ்வறிவித்தலை உருவாக்கியவர் அல்லாத நிலை 4 அல்லது 5 பணியாளரின் ஒப்புதல் தேவை.'
                : 'Wider broadcasts require sign-off by a Tier 4 or 5 staff member who did not author this submission.'}
            </p>
          </div>

          <form action={approveBroadcast} className="flex flex-col gap-4">
            <input type="hidden" name="broadcastId" value={preview.id} />

            <label className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" name="confirmApprove" value="1" required className="mt-0.5" />
              <span>
                {locale === 'ta'
                  ? 'இருமொழி உள்ளடக்கத்தை ஆய்வு செய்து, இலக்கு எல்லையைச் சரிபார்த்து, அனுப்ப ஒப்புதல் அளிக்கிறேன்.'
                  : 'I have reviewed the bilingual content, verified audience reach, and approve this broadcast for dispatch.'}
              </span>
            </label>

            <div className="flex justify-end">
              <SubmitButton tone="primary">
                <span lang={locale}>{locale === 'ta' ? 'ஒப்புதல் அளித்து திட்டமிடுக' : 'Approve & schedule broadcast'}</span>
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* Edit Form for Drafts */}
      {isDraft ? (
        <section aria-labelledby="edit-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <h2 id="edit-heading" className="text-base font-bold border-b border-line pb-2 text-text">
            {locale === 'ta' ? 'வரைவு உள்ளடக்கத்தைத் திருத்துதல்' : 'Edit draft content'}
          </h2>

          <form action={updateBroadcast} className="flex flex-col gap-4">
            <input type="hidden" name="broadcastId" value={preview.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                <span lang={locale}>{locale === 'ta' ? 'தலைப்பு (ஆங்கிலம்)' : 'Title (English)'}</span>
                <input
                  name="titleEn"
                  defaultValue={preview.titleEn}
                  maxLength={80}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                <span lang={locale}>{locale === 'ta' ? 'தலைப்பு (தமிழ்)' : 'Title (Tamil)'}</span>
                <input
                  name="titleTa"
                  defaultValue={preview.titleTa}
                  maxLength={80}
                  lang="ta"
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                <span lang={locale}>{locale === 'ta' ? 'செய்தி விவரம் (ஆங்கிலம்)' : 'Message body (English)'}</span>
                <textarea
                  name="bodyEn"
                  defaultValue={preview.bodyEn}
                  rows={4}
                  maxLength={1000}
                  className="rounded-lg border border-line p-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                <span lang={locale}>{locale === 'ta' ? 'செய்தி விவரம் (தமிழ்)' : 'Message body (Tamil)'}</span>
                <textarea
                  name="bodyTa"
                  defaultValue={preview.bodyTa}
                  rows={4}
                  maxLength={1000}
                  lang="ta"
                  className="rounded-lg border border-line p-3"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <SubmitButton tone="secondary">
                <span lang={locale}>{locale === 'ta' ? 'மாற்றங்களைச் சேமிக்க' : 'Save changes'}</span>
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* Cancel Option for Draft, Pending, or Scheduled */}
      {isDraft || isPending || isScheduled ? (
        <section aria-labelledby="cancel-heading" className="flex flex-col gap-4 rounded-xl border border-error/50 bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="cancel-heading" className="text-base font-bold text-error">
              {locale === 'ta' ? 'அறிவித்தலை இரத்துச் செய்தல்' : 'Cancel broadcast'}
            </h2>
            <p className="text-xs text-muted">
              {locale === 'ta' ? 'இரத்து செய்வது இந்தச் செய்தியை அனுப்புவதிலிருந்து மீட்டெடுக்கும்.' : 'Cancelling will withdraw this message from dispatch.'}
            </p>
          </div>

          <form action={cancelBroadcast} className="flex items-center justify-between gap-4">
            <input type="hidden" name="broadcastId" value={preview.id} />

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="confirmCancel" value="1" required />
              <span>{locale === 'ta' ? 'இரத்து செய்வதை உறுதிப்படுத்துகிறேன்' : 'Confirm cancellation'}</span>
            </label>

            <SubmitButton tone="danger">
              <span lang={locale}>{locale === 'ta' ? 'அறிவித்தலை இரத்துச் செய்க' : 'Cancel broadcast'}</span>
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {isCancelled ? (
        <div className="rounded-xl border border-line bg-card p-4 text-xs font-medium text-muted">
          {locale === 'ta' ? 'இந்த அறிவித்தல் இரத்து செய்யப்பட்டுள்ளது, இனி அனுப்பப்படாது.' : 'This broadcast was cancelled and cannot be sent.'}
        </div>
      ) : null}
    </>
  );
}
