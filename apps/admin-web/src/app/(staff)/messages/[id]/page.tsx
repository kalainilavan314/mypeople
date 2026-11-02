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
import { messageFor } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { isRefusal } from '@/lib/staff';

export default function BroadcastDetailPage(props: PageProps<'/messages/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading broadcast</p>}>
      <BroadcastDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function BroadcastDetail({ params, searchParams }: Pick<PageProps<'/messages/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params;
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const problems = Array.isArray(query.problems) ? query.problems[0] : query.problems;
  const done = Array.isArray(query.done) ? query.done[0] : query.done;

  const api = await staffApi();
  let preview: BroadcastPreview;

  try {
    preview = await api.previewBroadcast(id);
  } catch (err) {
    if (isRefusal(err)) {
      return (
        <div className="flex flex-col gap-4">
          <Link href="/messages" className="text-sm font-semibold text-primary underline">
            ← Back to broadcasts
          </Link>
          <p className="text-error">! {messageFor(err.code)}</p>
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
          ← Back to broadcasts
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
              {preview.topic}
            </span>
          </div>
          <p lang="ta" className="text-sm font-semibold text-muted">
            {preview.titleTa}
          </p>
          <h1 className="text-2xl font-bold">{preview.titleEn}</h1>
          <p className="text-xs text-muted">Target audience: {areaText(preview.areaKey)}</p>
        </div>
      </header>

      <Feedback error={error} problems={problems} done={done} />

      {/* Recipient Reach & Scope Estimate */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">Audience estimate</span>
          <p className="mt-1 text-2xl font-bold">{preview.reaches.toLocaleString()}</p>
          <p className="text-xs text-muted">active members in {areaText(preview.areaKey)}</p>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">Second-person approval</span>
          <p className="mt-1 font-semibold">{preview.needsApproval ? 'Required (Tier 4 or 5)' : 'Not required (Local area)'}</p>
          <p className="text-xs text-muted">
            {preview.needsApproval ? 'Scope wider than district requires senior approval' : 'District or division scope'}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-card p-4">
          <span className="text-xs text-muted">Status</span>
          <p className="mt-1 font-semibold capitalize">{preview.state.replace(/_/g, ' ')}</p>
          <p className="text-xs text-muted">
            {isSent && preview.sentAt ? `Dispatched ${formatDateTime(preview.sentAt)}` : ''}
            {isScheduled && preview.sendAt ? `Queued for dispatch at/after ${formatDateTime(preview.sendAt)}` : ''}
            {isCancelled ? 'Withdrawn from dispatch' : ''}
            {isDraft ? 'In preparation' : ''}
          </p>
        </div>
      </div>

      {isScheduled ? (
        <section aria-labelledby="scheduled-banner" className="rounded-xl border border-primary/40 bg-surface p-4 text-xs">
          <h2 id="scheduled-banner" className="font-bold text-primary">
            ✓ Queued for background worker dispatch
          </h2>
          <p className="mt-1 text-muted">
            This broadcast is queued for dispatch at or after {formatDateTime(preview.sendAt)}. Delivery is executed
            by the background notifications worker (<code className="font-mono text-xs">python -m app.tasks.notifications</code>).
          </p>
        </section>
      ) : null}

      {preview.problems.length > 0 ? (
        <section aria-labelledby="problems-notice" className="rounded-xl border border-error bg-error-bg p-4 text-error text-sm">
          <h2 id="problems-notice" className="font-bold">
            ! Content validation issues detected:
          </h2>
          <ul className="mt-1 list-disc pl-5">
            {preview.problems.map((p) => (
              <li key={p}>{messageFor(p)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Content Preview Cards */}
      <section aria-labelledby="preview-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
        <h2 id="preview-heading" className="text-base font-bold border-b border-line pb-2">
          Member message preview
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
            <span className="text-xs font-semibold text-muted">English broadcast</span>
            <p className="text-base font-bold">{preview.titleEn}</p>
            <p className="text-sm whitespace-pre-wrap">{preview.bodyEn}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
            <span className="text-xs font-semibold text-muted">Tamil broadcast / தமிழ்</span>
            <p lang="ta" className="text-base font-bold">
              {preview.titleTa}
            </p>
            <p lang="ta" className="text-sm whitespace-pre-wrap">
              {preview.bodyTa}
            </p>
          </div>
        </div>
      </section>

      {/* Lifecycle Actions */}
      {isDraft ? (
        <section aria-labelledby="send-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="send-heading" className="text-base font-bold">
              Dispatch or schedule broadcast
            </h2>
            <p className="text-xs text-muted">
              {preview.needsApproval
                ? 'Submitting will move this broadcast to pending approval for a senior staff reviewer.'
                : 'Submitting will queue this broadcast for immediate sending or scheduled dispatch.'}
            </p>
          </div>

          <form action={submitBroadcast} className="flex flex-col gap-4">
            <input type="hidden" name="broadcastId" value={preview.id} />

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="sendChoice" value="now" defaultChecked />
                <span>Send immediately</span>
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="sendChoice" value="later" />
                <span>Schedule for future time:</span>
                <input type="datetime-local" name="sendAt" className="min-h-10 rounded border border-line px-2 text-xs" />
              </label>
            </div>

            <div className="rounded-lg border border-warning/50 bg-warning-bg/30 p-4">
              <label className="flex items-start gap-2 text-sm font-semibold">
                <input type="checkbox" name="confirmSend" value="1" required className="mt-0.5" />
                <span>
                  I confirm this broadcast contains no personal names, NIC numbers, or confidential case information,
                  and is ready for transmission to {preview.reaches.toLocaleString()} members.
                </span>
              </label>
            </div>

            <div className="flex justify-end">
              <SubmitButton tone="primary">
                {preview.needsApproval ? 'Submit for senior approval' : 'Confirm & send broadcast'}
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {isPending ? (
        <section aria-labelledby="approval-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="approval-heading" className="text-base font-bold">
              Senior staff approval
            </h2>
            <p className="text-xs text-muted">
              Wider broadcasts require sign-off by a Tier 4 or 5 staff member who did not author this submission.
            </p>
          </div>

          <form action={approveBroadcast} className="flex flex-col gap-4">
            <input type="hidden" name="broadcastId" value={preview.id} />

            <label className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" name="confirmApprove" value="1" required className="mt-0.5" />
              <span>
                I have reviewed the bilingual content, verified audience reach, and approve this broadcast for dispatch.
              </span>
            </label>

            <div className="flex justify-end">
              <SubmitButton tone="primary">Approve & schedule broadcast</SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* Edit Form for Drafts */}
      {isDraft ? (
        <section aria-labelledby="edit-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-6">
          <h2 id="edit-heading" className="text-base font-bold border-b border-line pb-2">
            Edit draft content
          </h2>

          <form action={updateBroadcast} className="flex flex-col gap-4">
            <input type="hidden" name="broadcastId" value={preview.id} />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Title (English)
                <input
                  name="titleEn"
                  defaultValue={preview.titleEn}
                  maxLength={80}
                  className="min-h-11 rounded-lg border border-line px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Title (Tamil / தமிழ்)
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
                Message body (English)
                <textarea
                  name="bodyEn"
                  defaultValue={preview.bodyEn}
                  rows={4}
                  maxLength={1000}
                  className="rounded-lg border border-line p-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold">
                Message body (Tamil / தமிழ்)
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
              <SubmitButton tone="secondary">Save changes</SubmitButton>
            </div>
          </form>
        </section>
      ) : null}

      {/* Cancel Option for Draft, Pending, or Scheduled */}
      {isDraft || isPending || isScheduled ? (
        <section aria-labelledby="cancel-heading" className="flex flex-col gap-4 rounded-xl border border-error/50 bg-card p-6">
          <div className="border-b border-line pb-2">
            <h2 id="cancel-heading" className="text-base font-bold text-error">
              Cancel broadcast
            </h2>
            <p className="text-xs text-muted">Cancelling will withdraw this message from dispatch.</p>
          </div>

          <form action={cancelBroadcast} className="flex items-center justify-between gap-4">
            <input type="hidden" name="broadcastId" value={preview.id} />

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="confirmCancel" value="1" required />
              <span>Confirm cancellation</span>
            </label>

            <SubmitButton tone="danger">Cancel broadcast</SubmitButton>
          </form>
        </section>
      ) : null}

      {isCancelled ? (
        <div className="rounded-xl border border-line bg-card p-4 text-xs font-medium text-muted">
          This broadcast was cancelled and cannot be sent.
        </div>
      ) : null}
    </>
  );
}
