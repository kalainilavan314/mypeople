import { ApiError, type PromisePendingWork, type PromiseSummary } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { SimpleForm } from '@/components/SimpleForm';
import { decidePublication, decideUpdate, moderateFeedback } from '@/features/promises/actions';
import { DECISION_FIELDS, MODERATION_FIELDS } from '@/features/promises/decision';
import { PROMISE_TARGETS, STATUSES, STATUS_LABELS, STATUS_TONES, THEMES, THEME_LABELS } from '@/features/promises/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS_RING}`;
const REFUSED = 'The promise tracker needs promise editing, promise publishing or content moderation.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D16: promises in the viewer's areas by status and theme, and the approvals and feedback waiting. */
export default function PromisesPage(props: PageProps<'/promises'>) {
  return (
    <>
      <PageHeader ta="வாக்குறுதிக் கண்காணிப்பு" en="Promise tracker">
        <div className="flex flex-wrap gap-2">
          <Link href="/promises/report" className={`inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary ${FOCUS_RING}`}>
            Progress report
          </Link>
          <ButtonLink href="/promises/new">New promise</ButtonLink>
        </div>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <PromiseList searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={3} />}>
        <PendingWork />
      </Suspense>
    </>
  );
}

async function PromiseList({ searchParams }: { searchParams: PageProps<'/promises'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const status = STATUSES.find((item) => item === one(query.status));
  const theme = THEMES.find((item) => item === one(query.theme));

  let rows: PromiseSummary[];
  try {
    rows = await (await staffApi()).listManagedPromises({ status, theme });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="The promise tracker" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The promise list is not available." />;
  }
  const areaNames = await loadAreaNames(rows.map((row) => row.areaKey));

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Drafts, promises waiting for approval and published promises in your areas. Nothing is deleted: a promise is withdrawn with a
        public reason.
      </p>
      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        <label htmlFor="promise-status" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          Status
          <select id="promise-status" name="status" defaultValue={status ?? ''} className={CONTROL}>
            <option value="">All statuses</option>
            {STATUSES.map((code) => (
              <option key={code} value={code}>
                {STATUS_LABELS[code].ta} · {STATUS_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="promise-theme" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          Theme
          <select id="promise-theme" name="theme" defaultValue={theme ?? ''} className={CONTROL}>
            <option value="">All themes</option>
            {THEMES.map((code) => (
              <option key={code} value={code}>
                {THEME_LABELS[code].ta} · {THEME_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
          Apply filters
        </button>
        {status || theme ? (
          <Link href="/promises" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
            Clear filters
          </Link>
        ) : null}
      </form>
      <RecordTable
        caption="Promises"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Reference"
        href={(row) => `/promises/${row.id}`}
        linkText={(row) => row.promiseRef}
        empty={status || theme ? 'No promises match these filters.' : 'No promises in your areas yet.'}
        columns={[
          { header: 'Status', cell: (row) => <BilingualTag label={STATUS_LABELS[row.status]} tone={STATUS_TONES[row.status]} /> },
          { header: 'Promise', cell: (row) => <BilingualText ta={row.titleTa} en={row.titleEn} className="max-w-xs" /> },
          { header: 'Theme', cell: (row) => <BilingualText ta={THEME_LABELS[row.theme].ta} en={THEME_LABELS[row.theme].en} /> },
          { header: 'Office and area', cell: (row) => <span className="flex flex-col text-xs"><span className="text-text">{row.officeEn}</span><span className="text-muted">{areaText(row.areaKey, areaNames, 'en')}</span></span> },
          {
            header: 'Due',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>{formatDate(row.dueDate)}</span>
                <span>{row.lastVerifiedAt ? `verified ${formatDate(row.lastVerifiedAt)}` : 'not verified yet'}</span>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}

/** Promises and updates waiting for a second person (promise.publish), and feedback waiting for a moderator (D16). */
async function PendingWork() {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let pending: PromisePendingWork;
  try {
    pending = await (await staffApi()).getPromisePendingWork();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return null;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The pending work is not available." />;
  }
  const areaNames = await loadAreaNames(pending.publications.map((promise) => promise.areaKey));
  return (
    <>
      <Section id="pending-publications" ta="வெளியீட்டு அங்கீகாரத்துக்காகக் காத்திருக்கும் வாக்குறுதிகள்" en={`Promises waiting for publication approval (${pending.publications.length})`} intro="A second person approves every publication. Neither the person who drafted a promise nor the one who asked for publication can approve it.">
        {pending.publications.length === 0 ? (
          <p className="text-sm text-muted">No promises are waiting.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.publications.map((promise) => (
              <li key={promise.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/promises/${promise.id}`} className={`font-mono font-semibold text-primary underline ${FOCUS_RING}`}>
                    {promise.promiseRef}
                  </Link>
                  <BilingualTag label={THEME_LABELS[promise.theme]} />
                  <span className="text-xs text-muted">{areaText(promise.areaKey, areaNames, 'en')} · due {formatDate(promise.dueDate)}</span>
                </p>
                <BilingualText ta={promise.titleTa} en={promise.titleEn} />
                <SimpleForm
                  id={`publication-${promise.id.slice(0, 8)}`}
                  action={decidePublication}
                  hidden={{ promiseId: promise.id, returnTo: 'list' }}
                  fields={DECISION_FIELDS}
                  submits={[{ label: 'Record decision' }]}
                  targets={PROMISE_TARGETS}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section id="pending-updates" ta="அங்கீகாரத்துக்காகக் காத்திருக்கும் புதுப்பிப்புகள்" en={`Updates waiting for approval (${pending.updates.length})`} intro="A second person approves every status change. You cannot approve an update you drafted.">
        {pending.updates.length === 0 ? (
          <p className="text-sm text-muted">No updates are waiting.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.updates.map((update) => (
              <li key={update.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  {update.newStatus ? <BilingualTag label={STATUS_LABELS[update.newStatus]} tone={STATUS_TONES[update.newStatus]} /> : <span className="text-xs text-muted">No status change</span>}
                  {update.correctsId ? <span className="text-xs font-semibold text-warning">Correction of an earlier update</span> : null}
                  <span className="text-xs tabular-nums text-muted">drafted {formatDateTime(update.createdAt)}</span>
                </p>
                <p lang="ta" className="whitespace-pre-wrap text-text">{update.noteTa}</p>
                <p lang="en" className="whitespace-pre-wrap text-muted">{update.noteEn}</p>
                {update.evidenceRefs.length > 0 ? <p className="text-xs text-muted">Evidence: {update.evidenceRefs.join(' · ')}</p> : null}
                <SimpleForm
                  id={`update-${update.id.slice(0, 8)}`}
                  action={decideUpdate}
                  hidden={{ updateId: update.id, returnTo: 'list' }}
                  fields={DECISION_FIELDS}
                  submits={[{ label: 'Record decision' }]}
                  targets={PROMISE_TARGETS}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section id="pending-feedback" ta="நடுவருக்காகக் காத்திருக்கும் கருத்துகள்" en={`Member feedback waiting for moderation (${pending.feedback.length})`} intro="Members see feedback only after it is published.">
        {pending.feedback.length === 0 ? (
          <p className="text-sm text-muted">No feedback is waiting.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.feedback.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                <p className="text-xs tabular-nums text-muted">sent {formatDateTime(item.createdAt)}</p>
                <p className="whitespace-pre-wrap text-text">{item.body}</p>
                <SimpleForm
                  id={`feedback-${item.id.slice(0, 8)}`}
                  action={moderateFeedback}
                  hidden={{ feedbackId: item.id, returnTo: 'list' }}
                  fields={MODERATION_FIELDS}
                  submits={[{ label: 'Record decision' }]}
                  targets={PROMISE_TARGETS}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

