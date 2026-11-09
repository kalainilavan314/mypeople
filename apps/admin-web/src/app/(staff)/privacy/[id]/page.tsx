import type { ApiClient, PrivacyRegisterEntry } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { CONTROL, FormField } from '@/components/FormField';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { closePrivacyRequest } from '@/features/privacy/actions';
import { DueTag } from '@/features/privacy/DueTag';
import { dueStatus, kindText } from '@/features/privacy/register';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary, getLocalizedProblem, type Locale, type TranslationDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const PERMISSION = 'privacy.requests.handle';
const UUID = /^[0-9a-f-]{36}$/i;
const LIMIT = 500;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

type Words = TranslationDictionary['privacy'];

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function PrivacyRequestPage(props: PageProps<'/privacy/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={5} />}>
      <RequestFile params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

/**
 * The API has no single-request read for staff, so the request is found in the DPO register:
 * open ones first, since those are the ones acted on, then closed ones.
 */
async function findInRegister(client: ApiClient, id: string): Promise<PrivacyRegisterEntry | null> {
  const open = await client.listPrivacyRegister({ states: ['open'], limit: LIMIT });
  const found = open.find((entry) => entry.id === id);
  if (found) return found;
  const closed = await client.listPrivacyRegister({ states: ['completed', 'refused'], limit: LIMIT });
  return closed.find((entry) => entry.id === id) ?? null;
}

async function RequestFile({ params, searchParams }: Pick<PageProps<'/privacy/[id]'>, 'params' | 'searchParams'>) {
  // Everything below is read when the request comes in: API_URL may be set only on the running
  // server, and the due-date marks depend on the current time.
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const words = getDictionary(locale).privacy;
  const backLink = (
    <Link href="/privacy" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      <span lang={locale}>← {words.backToList}</span>
    </Link>
  );
  if (!staff.permissions.has(PERMISSION)) return <PageProblem locale={locale} message={words.refused} />;

  const { id } = await params;
  const query = await searchParams;
  let entry: PrivacyRegisterEntry | null = null;
  if (UUID.test(id)) {
    try {
      entry = await findInRegister(await staffApi(), id);
    } catch (error) {
      return (
        <>
          {backLink}
          <LoadFailure error={error} locale={locale} refused={words.refused} notFound={words.notFound} />
        </>
      );
    }
  }
  if (!entry) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={words.notFound} />
      </>
    );
  }
  const due = dueStatus(entry, new Date());
  const problems = (one(query.problems) ?? '').split(',').filter(Boolean);

  return (
    <>
      {backLink}

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted">{entry.requestRef}</span>
          <StateTag state={entry.state} />
          <DueTag status={due} words={words} locale={locale} />
        </div>
        <h1 lang={locale} className="text-2xl font-semibold tracking-tight">
          {kindText(entry.kind, words)}
        </h1>
      </header>

      <Feedback error={one(query.error)} problems={one(query.problems)} done={one(query.done)} />

      <section aria-labelledby="request-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
        <h2 id="request-heading" lang={locale} className="text-base font-bold">
          {words.requestTitle}
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Detail label={words.memberCode} locale={locale}>
            <span className="font-mono">{entry.memberCode}</span>
          </Detail>
          <Detail label={words.receivedAt} locale={locale}>
            {formatDateTime(entry.createdAt)}
          </Detail>
          <Detail label={words.dueAt} locale={locale}>
            {formatDateTime(entry.dueAt)}
          </Detail>
          {entry.closedAt ? (
            <Detail label={words.closedAt} locale={locale}>
              {formatDateTime(entry.closedAt)}
            </Detail>
          ) : null}
        </dl>
        <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <h3 lang={locale} className="text-xs font-semibold text-muted">
            {words.memberNote}
          </h3>
          {entry.note ? (
            <p className="whitespace-pre-wrap">{entry.note}</p>
          ) : (
            <p lang={locale} className="text-muted">
              {words.memberNoteEmpty}
            </p>
          )}
        </div>
        {entry.outcomeNote ? (
          <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
            <h3 lang={locale} className="text-xs font-semibold text-muted">
              {words.outcomeNote}
            </h3>
            <p className="whitespace-pre-wrap">{entry.outcomeNote}</p>
          </div>
        ) : null}
      </section>

      {entry.retention.length > 0 ? (
        <section aria-labelledby="retention-heading" className="flex flex-col gap-3">
          <h2 id="retention-heading" lang={locale} className="text-base font-bold">
            {words.retentionTitle}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table aria-labelledby="retention-heading" className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs">
                <tr>
                  <th scope="col" lang={locale} className="px-3 py-2 font-semibold">
                    {words.retentionData}
                  </th>
                  <th scope="col" lang={locale} className="px-3 py-2 font-semibold">
                    {words.retentionKept}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entry.retention.map((item) => (
                  <tr key={item.dataEn}>
                    <td lang={locale} className="px-3 py-2 font-medium">
                      {locale === 'ta' ? item.dataTa : item.dataEn}
                    </td>
                    <td lang={locale} className="px-3 py-2">
                      {locale === 'ta' ? item.keptTa : item.keptEn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {entry.state === 'open' ? (
        <CloseRequestForm entry={entry} words={words} problems={problems} locale={locale} />
      ) : (
        <p lang={locale} className="rounded-xl border border-line bg-card p-4 text-sm text-muted">
          {words.closedText}
        </p>
      )}
    </>
  );
}

function Detail({ label, locale, children }: { label: string; locale: Locale; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt lang={locale} className="text-xs font-semibold text-muted">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function CloseRequestForm({ entry, words, problems, locale }: { entry: PrivacyRegisterEntry; words: Words; problems: string[]; locale: Locale }) {
  const outcomeProblem = problems.includes('outcome_required');
  const confirmProblem = problems.includes('confirmation_required');
  const closure = entry.kind === 'closure';
  return (
    <form action={closePrivacyRequest} aria-labelledby="close-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-2">
        <h2 id="close-heading" lang={locale} className="text-base font-bold">
          {words.closeTitle}
        </h2>
        <p lang={locale} className={`text-sm ${closure ? 'font-semibold text-error' : 'text-muted'}`}>
          {closure ? (
            <>
              <span aria-hidden="true">! </span>
              {words.closeIntroClosure}
            </>
          ) : (
            words.closeIntroCopy
          )}
        </p>
      </div>
      <input type="hidden" name="requestId" value={entry.id} />

      <fieldset className="flex flex-col gap-2" aria-describedby={outcomeProblem ? 'outcome-error' : undefined}>
        <legend lang={locale} className="mb-1 text-sm font-semibold">
          {words.fieldOutcome} <span aria-hidden="true">*</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 text-sm">
            <input id="input-outcome" type="radio" name="outcome" value="completed" required className={`h-5 w-5 accent-primary ${FOCUS}`} />
            <span lang={locale}>{words.outcomeCompleted}</span>
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 text-sm">
            <input type="radio" name="outcome" value="refused" required className={`h-5 w-5 accent-primary ${FOCUS}`} />
            <span lang={locale}>{words.outcomeRefused}</span>
          </label>
        </div>
        {outcomeProblem ? (
          <p id="outcome-error" lang={locale} className="text-xs font-semibold text-error">
            ! {getLocalizedProblem('outcome_required', locale)}
          </p>
        ) : null}
      </fieldset>

      <FormField name="note" label={words.fieldNote} hint={words.noteHint} required problems={problems} locale={locale}>
        {(control) => <textarea {...control} required minLength={3} maxLength={2000} rows={4} className={`${CONTROL} py-2 leading-relaxed`} />}
      </FormField>

      <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
        <input
          id="input-confirm"
          type="checkbox"
          name="confirm"
          value="1"
          required
          aria-invalid={confirmProblem ? true : undefined}
          className={`mt-0.5 h-5 w-5 shrink-0 accent-primary ${FOCUS}`}
        />
        <span lang={locale}>{closure ? words.confirmCloseClosure : words.confirmClose}</span>
      </label>

      <div className="flex justify-end">
        <SubmitButton tone={closure ? 'danger' : 'primary'}>
          <span lang={locale}>{words.submitClose}</span>
        </SubmitButton>
      </div>
    </form>
  );
}
