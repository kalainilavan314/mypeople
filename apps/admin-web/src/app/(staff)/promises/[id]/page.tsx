import { ApiError, type PromiseDetail } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import { decidePublication, decideUpdate, draftUpdate, moderateFeedback, replyToFeedback, requestPublication } from '@/features/promises/actions';
import { DECISION_FIELDS, MODERATION_FIELDS, REPLY_FIELDS } from '@/features/promises/decision';
import {
  KIND_LABELS,
  PROMISE_TARGETS,
  PUBLICATION_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  THEME_LABELS,
  UPDATE_STATUSES,
} from '@/features/promises/forms';
import { PromiseForm } from '@/features/promises/PromiseForm';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This promise does not exist or is outside your areas.';
const REFUSED = 'The promise tracker needs promise editing, promise publishing or content moderation.';
const DECISION_TONES = { pending: 'waiting', approved: 'done', rejected: 'refused', system: 'neutral' } as const;
const DECISION_LABELS = {
  pending: { ta: 'அங்கீகாரத்துக்காகக் காத்திருக்கிறது', en: 'Waiting for approval' },
  approved: { ta: 'அங்கீகரிக்கப்பட்டது', en: 'Approved' },
  rejected: { ta: 'திருப்பியனுப்பப்பட்டது', en: 'Returned' },
  system: { ta: 'கணினியால் பதிவுசெய்யப்பட்டது', en: 'Recorded by the system' },
} as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D16: one promise, its milestones and updates, the approvals and feedback waiting, and its draft. */
export default function PromisePage(props: PageProps<'/promises/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <PromiseView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PromiseView({ params, searchParams }: Pick<PageProps<'/promises/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/promises">Back to the promise tracker</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let promise: PromiseDetail;
  try {
    promise = await (await staffApi()).getManagedPromise(id);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="The promise tracker" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }

  const areaNames = await loadAreaNames([promise.areaKey]);
  const published = promise.publication === 'published';
  const approvedUpdates = promise.updates.filter((update) => update.decision === 'approved' || update.decision === 'system');
  const current: Record<string, string> = {
    titleTa: promise.titleTa,
    titleEn: promise.titleEn,
    descriptionTa: promise.descriptionTa,
    descriptionEn: promise.descriptionEn,
    officeTa: promise.officeTa,
    officeEn: promise.officeEn,
    targetTa: promise.targetTa,
    targetEn: promise.targetEn,
    blockersTa: promise.blockersTa ?? '',
    blockersEn: promise.blockersEn ?? '',
    sourceReference: promise.sourceReference,
    sourcePublishedOn: promise.sourcePublishedOn,
    kind: promise.kind,
    theme: promise.theme,
    plannedStart: promise.plannedStart,
    dueDate: promise.dueDate,
    milestonesJson: JSON.stringify(promise.milestones),
  };
  const updateFields: FieldSpec[] = [
    {
      name: 'newStatus',
      label: 'New status (optional)',
      kind: 'select',
      hint: 'Delayed is set by the due date, not chosen. Completed needs evidence; Blocked and Withdrawn need the reason in the note.',
      options: [{ value: '', label: 'No change of status' }, ...UPDATE_STATUSES.map((status) => ({ value: status, label: `${STATUS_LABELS[status].ta} · ${STATUS_LABELS[status].en}` }))],
    },
    {
      name: 'correctsId',
      label: 'Corrects an earlier update (optional)',
      kind: 'select',
      hint: 'A correction stays beside the update it corrects; the original remains visible.',
      options: [
        { value: '', label: 'Not a correction' },
        ...approvedUpdates.map((update) => ({ value: update.id, label: `${formatDate(update.createdAt)} · ${update.noteEn.slice(0, 60)}` })),
      ],
    },
    { name: 'noteTa', label: 'Update in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 5, maxLength: 4500 },
    { name: 'noteEn', label: 'Update in English', kind: 'textarea', lang: 'en', required: true, minLength: 5, maxLength: 3000 },
    { name: 'evidenceRefs', label: 'Evidence references, one per line', kind: 'textarea', hint: 'Needed for Completed. At most 20.', maxLength: 4000, wide: true },
  ];

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{promise.promiseRef}</span>
          <BilingualTag label={STATUS_LABELS[promise.status]} tone={STATUS_TONES[promise.status]} />
          <BilingualTag label={PUBLICATION_LABELS[promise.publication]} tone={published ? 'done' : 'waiting'} />
          <BilingualTag label={KIND_LABELS[promise.kind]} />
          <BilingualTag label={THEME_LABELS[promise.theme]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{promise.titleTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {promise.titleEn}
          </span>
        </h1>
        <p className="text-sm text-muted">
          {areaText(promise.areaKey, areaNames, 'en')} · due {formatDate(promise.dueDate)}
          {promise.lastVerifiedAt ? ` · last verified ${formatDateTime(promise.lastVerifiedAt)}` : ''}
          {promise.updateDueAt ? ` · an update is due by ${formatDateTime(promise.updateDueAt)}` : ''}
        </p>
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="promise" ta="வாக்குறுதி" en="The promise">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><Detail label="Description"><Both ta={promise.descriptionTa} en={promise.descriptionEn} /></Detail></div>
              <div className="sm:col-span-2"><Detail label="Measurable target"><Both ta={promise.targetTa} en={promise.targetEn} /></Detail></div>
              <Detail label="Office responsible"><Both ta={promise.officeTa} en={promise.officeEn} /></Detail>
              <Detail label="Source">{promise.sourceReference} · published {formatDate(promise.sourcePublishedOn)}</Detail>
              <Detail label="Planned start">{formatDate(promise.plannedStart)}</Detail>
              <Detail label="Due">{formatDate(promise.dueDate)}</Detail>
              {promise.blockersEn || promise.blockersTa ? <div className="sm:col-span-2"><Detail label="Known blockers"><Both ta={promise.blockersTa} en={promise.blockersEn} /></Detail></div> : null}
              {promise.statusReason ? <div className="sm:col-span-2"><Detail label="Reason shown with the status">{promise.statusReason}</Detail></div> : null}
            </dl>
          </Section>

          <Section id="milestones" ta="மைல்கற்கள்" en={`Milestones (${promise.milestones.length})`}>
            {promise.milestones.length === 0 ? (
              <p className="text-sm text-muted">No milestones yet. Publication needs at least one.</p>
            ) : (
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                {promise.milestones.map((milestone, index) => (
                  <li key={`${index}-${milestone.titleEn}`}>
                    <Both ta={milestone.titleTa} en={milestone.titleEn} />
                    {milestone.dueDate ? <span className="text-xs text-muted">due {formatDate(milestone.dueDate)}</span> : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section id="updates" ta="புதுப்பிப்புகள்" en={`Updates (${promise.updates.length})`} intro="Every update is approved by a second person before members see it. Corrections stay beside the original.">
            {promise.updates.length === 0 ? (
              <p className="text-sm text-muted">No updates yet.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {promise.updates.map((update) => (
                  <li key={update.id} className="flex flex-col gap-2 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <BilingualTag label={DECISION_LABELS[update.decision]} tone={DECISION_TONES[update.decision]} />
                      {update.newStatus ? <BilingualTag label={STATUS_LABELS[update.newStatus]} tone={STATUS_TONES[update.newStatus]} /> : null}
                      {update.correctsId ? <span className="text-xs font-semibold text-warning">Correction of the update of {formatDate(promise.updates.find((u) => u.id === update.correctsId)?.createdAt)}</span> : null}
                      <span className="text-xs tabular-nums text-muted">{formatDateTime(update.createdAt)}</span>
                    </p>
                    <Both ta={update.noteTa} en={update.noteEn} />
                    {update.evidenceRefs.length > 0 ? <p className="text-xs text-muted">Evidence: {update.evidenceRefs.join(' · ')}</p> : null}
                    {update.decisionReason ? <p className="text-xs text-muted">Reason: {update.decisionReason}</p> : null}
                    {update.decision === 'pending' ? (
                      <SimpleForm id={`update-${update.id.slice(0, 8)}`} action={decideUpdate} hidden={{ updateId: update.id, promiseId: promise.id }} fields={DECISION_FIELDS} submits={[{ label: 'Record decision' }]} targets={PROMISE_TARGETS} />
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section id="feedback" ta="உறுப்பினர் கருத்துகள்" en={`Member feedback (${promise.feedback.length})`} intro="Feedback is moderated before others see it; the office may reply to published feedback in both languages.">
            {promise.feedback.length === 0 ? (
              <p className="text-sm text-muted">No feedback yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {promise.feedback.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <BilingualTag
                        label={item.state === 'pending' ? DECISION_LABELS.pending : item.state === 'published' ? { ta: 'வெளியிடப்பட்டது', en: 'Published' } : { ta: 'நிராகரிக்கப்பட்டது', en: 'Rejected' }}
                        tone={item.state === 'pending' ? 'waiting' : item.state === 'published' ? 'done' : 'refused'}
                      />
                      <span className="text-xs tabular-nums text-muted">{formatDateTime(item.createdAt)}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-text">{item.body}</p>
                    {item.replyEn || item.replyTa ? (
                      <div className="rounded-lg bg-surface p-3">
                        <p className="text-xs font-semibold text-muted">Office reply · {formatDateTime(item.repliedAt)}</p>
                        <Both ta={item.replyTa} en={item.replyEn} />
                      </div>
                    ) : null}
                    {item.state === 'pending' ? (
                      <SimpleForm id={`feedback-${item.id.slice(0, 8)}`} action={moderateFeedback} hidden={{ feedbackId: item.id, promiseId: promise.id }} fields={MODERATION_FIELDS} submits={[{ label: 'Record decision' }]} targets={PROMISE_TARGETS} />
                    ) : null}
                    {item.state === 'published' && !item.repliedAt ? (
                      <SimpleForm id={`reply-${item.id.slice(0, 8)}`} action={replyToFeedback} hidden={{ feedbackId: item.id, promiseId: promise.id }} fields={REPLY_FIELDS} submits={[{ label: 'Send reply', tone: 'secondary' }]} targets={PROMISE_TARGETS} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {published ? null : (
            <Section id="edit" ta="வரைவை மாற்றுதல்" en="Change the draft" intro="A published promise changes only through approved updates.">
              <PromiseForm promiseId={promise.id} current={current} />
            </Section>
          )}
        </div>

        <aside aria-label="Publication and updates" className="flex flex-col gap-4">
          {promise.publication === 'draft' ? (
            <SimpleForm
              id="request"
              title="Ask for publication"
              intro="A second person with promise publishing approves it. Publication needs at least one milestone."
              action={requestPublication}
              hidden={{ promiseId: promise.id }}
              fields={[]}
              submits={[{ label: 'Ask for approval' }]}
              targets={PROMISE_TARGETS}
            />
          ) : null}
          {promise.publication === 'awaiting_approval' ? (
            <SimpleForm
              id="publication"
              title="Publication decision"
              intro="The person who asked for publication cannot approve it."
              action={decidePublication}
              hidden={{ promiseId: promise.id }}
              fields={DECISION_FIELDS}
              submits={[{ label: 'Record decision' }]}
              targets={PROMISE_TARGETS}
            />
          ) : null}
          {published ? (
            <SimpleForm
              id="new-update"
              title="Draft an update"
              intro="It is published only after a second person approves it."
              action={draftUpdate}
              hidden={{ promiseId: promise.id }}
              fields={updateFields}
              submits={[{ label: 'Save update for approval' }]}
              targets={PROMISE_TARGETS}
            />
          ) : null}
          {promise.publishedAt ? <p className="text-xs text-muted">Published {formatDateTime(promise.publishedAt)}</p> : null}
        </aside>
      </div>
    </>
  );
}
