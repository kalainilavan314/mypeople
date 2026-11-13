import { ApiError, type TownHallQuestion, type TownHallStaffSession } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import { answerQuestion, moderateQuestion, moveTownHall } from '@/features/townhalls/actions';
import { ArchiveForm } from '@/features/townhalls/ArchiveForm';
import { LANGUAGE_LABELS, MOVES, MOVE_LABELS, STATE_LABELS, STATE_TONES, TOWNHALL_TARGETS, atTime } from '@/features/townhalls/forms';
import { TownHallForm } from '@/features/townhalls/TownHallForm';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime, toSriLankaDateTimeInput } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This session does not exist or is outside your areas.';
const REFUSED = 'Town halls need town hall production or question moderation.';
const QUESTION_LABELS = {
  pending: { ta: 'நடுவருக்காகக் காத்திருக்கிறது', en: 'Waiting for moderation' },
  approved: { ta: 'அங்கீகரிக்கப்பட்டது', en: 'Approved' },
  rejected: { ta: 'நிராகரிக்கப்பட்டது', en: 'Rejected' },
  merged: { ta: 'இணைக்கப்பட்டது', en: 'Merged' },
} as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D18: one session: its details, state moves, the question queue, answers and the archive. */
export default function TownHallPage(props: PageProps<'/town-halls/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <SessionView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

function moderationFields(approved: readonly TownHallQuestion[]): FieldSpec[] {
  const needsReason = { field: 'decision', values: ['reject', 'merge'] } as const;
  return [
    {
      name: 'decision',
      label: 'Decision',
      kind: 'radio',
      required: true,
      options: [
        { value: 'approve', label: 'Approve: others see it and can vote' },
        ...(approved.length ? [{ value: 'merge', label: 'Merge into an approved question' }] : []),
        { value: 'reject', label: 'Reject with a reason' },
      ],
    },
    {
      name: 'mergeInto',
      label: 'Merge into',
      kind: 'select',
      required: true,
      wide: true,
      showWhen: { field: 'decision', values: ['merge'] },
      options: [{ value: '', label: 'Choose the approved question' }, ...approved.map((q) => ({ value: q.id, label: q.body.slice(0, 90) }))],
    },
    { name: 'reason', label: 'Reason, shown to the person who asked', kind: 'textarea', required: true, maxLength: 500, showWhen: needsReason },
  ];
}

const ANSWER_FIELDS: FieldSpec[] = [
  {
    name: 'mode',
    label: 'How it was answered',
    kind: 'radio',
    required: true,
    options: [
      { value: 'live', label: 'Live, in the recording' },
      { value: 'written', label: 'In writing, in Tamil and English' },
    ],
  },
  { name: 'atSecond', label: 'Seconds into the recording', kind: 'number', required: true, min: 0, max: 999999, showWhen: { field: 'mode', values: ['live'] }, hint: 'For 1:02:05 enter 3725.' },
  { name: 'answerTa', label: 'Answer in Tamil', kind: 'textarea', lang: 'ta', required: true, maxLength: 6000, showWhen: { field: 'mode', values: ['written'] } },
  { name: 'answerEn', label: 'Answer in English', kind: 'textarea', lang: 'en', required: true, maxLength: 4000, showWhen: { field: 'mode', values: ['written'] } },
];

async function SessionView({ params, searchParams }: Pick<PageProps<'/town-halls/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/town-halls">Back to town halls</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let session: TownHallStaffSession;
  try {
    session = await (await staffApi()).getManagedTownHall(id);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="Town halls" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }

  const areaNames = await loadAreaNames([session.areaKey]);
  const producer = staff.permissions.has('townhall.produce');
  const moderator = staff.permissions.has('townhall.moderate');
  const pending = session.questions.filter((q) => q.state === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const approved = session.questions.filter((q) => q.state === 'approved').sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const closed = session.questions.filter((q) => q.state === 'rejected' || q.state === 'merged');
  const moves = MOVES[session.state];
  const hidden = { townhallId: session.id };
  const current: Record<string, string> = {
    titleTa: session.titleTa,
    titleEn: session.titleEn,
    descriptionTa: session.descriptionTa,
    descriptionEn: session.descriptionEn,
    speakersTa: session.speakersTa,
    speakersEn: session.speakersEn,
    language: session.language,
    startsAt: toSriLankaDateTimeInput(session.startsAt),
    endsAt: toSriLankaDateTimeInput(session.endsAt),
    streamUrl: session.streamUrl ?? '',
    audioUrl: session.audioUrl ?? '',
    captionsUrl: session.captionsUrl ?? '',
    legalReviewRef: session.legalReviewRef ?? '',
  };
  const archive: Record<string, string> = {
    recordingUrl: session.recordingUrl ?? '',
    transcriptTa: session.transcriptTa ?? '',
    transcriptEn: session.transcriptEn ?? '',
    outcomesJson: JSON.stringify(session.outcomes),
  };

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{session.sessionRef}</span>
          <BilingualTag label={STATE_LABELS[session.state]} tone={STATE_TONES[session.state]} />
          <BilingualTag label={LANGUAGE_LABELS[session.language]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{session.titleTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {session.titleEn}
          </span>
        </h1>
        <p className="text-sm text-muted">
          {formatDateTime(session.startsAt)} to {formatDateTime(session.endsAt)} · {areaText(session.areaKey, areaNames, 'en')}
        </p>
        {session.cancelReason ? <p className="text-sm text-error">! Cancelled: {session.cancelReason}</p> : null}
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="queue" ta="நடுவர் வரிசை" en={`Questions waiting for moderation (${pending.length})`} intro="Oldest first. The person who asked sees the reason for a rejection or merge.">
            {pending.length === 0 ? (
              <p className="text-sm text-muted">No questions are waiting.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {pending.map((question) => (
                  <li key={question.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                    <p className="text-xs tabular-nums text-muted">asked {formatDateTime(question.createdAt)}</p>
                    <p className="whitespace-pre-wrap text-text">{question.body}</p>
                    {moderator ? (
                      <SimpleForm id={`moderate-${question.id.slice(0, 8)}`} action={moderateQuestion} hidden={{ ...hidden, questionId: question.id }} fields={moderationFields(approved)} submits={[{ label: 'Record decision' }]} targets={TOWNHALL_TARGETS} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="approved" ta="அங்கீகரிக்கப்பட்ட கேள்விகள்" en={`Approved questions (${approved.length})`} intro="Most votes first. Answer live with the time in the recording, or in writing afterwards in both languages.">
            {approved.length === 0 ? (
              <p className="text-sm text-muted">No approved questions yet.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {approved.map((question) => (
                  <li key={question.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                    <p className="text-xs tabular-nums text-muted">
                      {question.votes ?? 0} votes · asked {formatDateTime(question.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap text-text">{question.body}</p>
                    {question.answerMode === 'live' && question.answeredAtSecond !== null ? (
                      <p className="text-sm font-semibold text-success">Answered live at {atTime(question.answeredAtSecond)} in the recording.</p>
                    ) : null}
                    {question.answerMode === 'written' ? (
                      <div className="rounded-lg bg-surface p-2">
                        <p className="text-xs font-semibold text-muted">Written answer</p>
                        <Both ta={question.answerTa} en={question.answerEn} />
                      </div>
                    ) : null}
                    {producer && !question.answerMode ? (
                      <SimpleForm id={`answer-${question.id.slice(0, 8)}`} action={answerQuestion} hidden={{ ...hidden, questionId: question.id }} fields={ANSWER_FIELDS} submits={[{ label: 'Record answer', tone: 'secondary' }]} targets={TOWNHALL_TARGETS} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {closed.length > 0 ? (
            <Section id="closed" ta="நிராகரிக்கப்பட்டவையும் இணைக்கப்பட்டவையும்" en={`Rejected and merged (${closed.length})`}>
              <ul className="flex flex-col divide-y divide-line text-sm">
                {closed.map((question) => (
                  <li key={question.id} className="flex flex-col gap-1 py-2">
                    <BilingualTag label={QUESTION_LABELS[question.state]} tone="neutral" />
                    <p className="whitespace-pre-wrap text-text">{question.body}</p>
                    {question.moderationReason ? <p className="text-xs text-muted">Reason: {question.moderationReason}</p> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section id="details" ta="அமர்வு விவரங்கள்" en="Session details">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><Detail label="Description"><Both ta={session.descriptionTa} en={session.descriptionEn} /></Detail></div>
              <Detail label="Speakers"><Both ta={session.speakersTa} en={session.speakersEn} /></Detail>
              <Detail label="Links">
                {session.streamUrl || session.audioUrl || session.captionsUrl
                  ? [session.streamUrl && 'video', session.audioUrl && 'audio', session.captionsUrl && 'captions'].filter(Boolean).join(', ')
                  : 'None yet: the streaming provider is still to be chosen (OD-44).'}
              </Detail>
            </dl>
          </Section>

          {producer && (session.state === 'draft' || session.state === 'scheduled') ? (
            <Section id="edit" ta="அமர்வை மாற்றுதல்" en="Change the session">
              <TownHallForm townhallId={session.id} current={current} />
            </Section>
          ) : null}
        </div>

        <aside aria-label="Session state" className="flex flex-col gap-4">
          {producer && moves.filter((move) => move !== 'cancelled').length > 0 ? (
            <SimpleForm
              id="move"
              title="Run the session"
              intro="Refused while an election silence period covers this area and time; in an election period a legal review reference is needed."
              action={moveTownHall}
              hidden={hidden}
              fields={[]}
              submits={moves.filter((move) => move !== 'cancelled').map((move) => ({ label: `${MOVE_LABELS[move].ta} · ${MOVE_LABELS[move].en}`, name: 'state', value: move }))}
              targets={TOWNHALL_TARGETS}
            />
          ) : null}
          {producer && moves.includes('cancelled') ? (
            <SimpleForm
              id="cancel"
              title="Cancel the session"
              intro="Members who set a reminder are told, with your reason."
              action={moveTownHall}
              hidden={{ ...hidden, state: 'cancelled' }}
              fields={[{ name: 'reason', label: 'Reason', kind: 'textarea', required: true, maxLength: 500 }]}
              submits={[{ label: 'Cancel the session', tone: 'danger' }]}
              targets={TOWNHALL_TARGETS}
            />
          ) : null}
          {producer && session.state === 'ended' ? <ArchiveForm townhallId={session.id} current={archive} /> : null}
        </aside>
      </div>
    </>
  );
}
