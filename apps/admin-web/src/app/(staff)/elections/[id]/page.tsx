import type { ElectionNotice, ElectionPeriodFile } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { CONTROL, FormField } from '@/components/FormField';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { StateTag } from '@/components/StateTag';
import { SubmitButton } from '@/components/SubmitButton';
import { closePeriod, withdrawNotice } from '@/features/elections/actions';
import { areaKeyText, electionTypeText, overlapRefs, silenceStatus, silenceText } from '@/features/elections/periods';
import { PublishNoticeForm } from '@/features/elections/PublishNoticeForm';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary, getLocalizedProblem, type Locale, type TranslationDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const PERMISSION = 'election.mode.manage';
const UUID = /^[0-9a-f-]{36}$/i;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

type Words = TranslationDictionary['elections'];

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function ElectionPeriodPage(props: PageProps<'/elections/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={6} />}>
      <PeriodFile params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PeriodFile({ params, searchParams }: Pick<PageProps<'/elections/[id]'>, 'params' | 'searchParams'>) {
  // Everything below is read when the request comes in: API_URL may be set only on the running
  // server, and the silence marks depend on the current time.
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const dictionary = getDictionary(locale);
  const words = dictionary.elections;
  const backLink = (
    <Link href="/elections" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      <span lang={locale}>← {words.backToList}</span>
    </Link>
  );
  if (!staff.permissions.has(PERMISSION)) return <PageProblem locale={locale} message={words.refused} />;

  const { id } = await params;
  const query = await searchParams;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={words.notFound} />
      </>
    );
  }

  let period: ElectionPeriodFile;
  try {
    period = await (await staffApi()).getElectionPeriod(id);
  } catch (error) {
    return (
      <>
        {backLink}
        <LoadFailure error={error} locale={locale} refused={words.refused} notFound={words.notFound} />
      </>
    );
  }
  const silence = silenceStatus(period, new Date());
  const overlaps = overlapRefs(one(query.overlaps));
  const declared = period.state === 'declared';

  return (
    <>
      {backLink}

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted">{period.periodRef}</span>
          <StateTag state={period.state} />
        </div>
        <h1 lang={locale} className="text-2xl font-semibold tracking-tight">
          {locale === 'ta' ? period.titleTa : period.titleEn}
        </h1>
        <p lang={locale} className="text-sm text-muted">
          {electionTypeText(period.electionType, words)} · {areaKeyText(period.areaKey, words)}
        </p>
      </header>

      <Feedback error={one(query.error)} problems={one(query.problems)} done={one(query.done)} />

      {overlaps.length > 0 ? (
        <section aria-labelledby="overlap-heading" className="rounded-xl border border-warning bg-warning-bg p-4 text-sm text-warning">
          <h2 id="overlap-heading" lang={locale} className="font-bold">
            ! {words.overlapTitle}
          </h2>
          <p lang={locale} className="mt-1">
            {words.overlapText.replace('{refs}', overlaps.join(', '))}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="details-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
          <h2 id="details-heading" lang={locale} className="text-base font-bold">
            {words.detailsTitle}
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label={words.colPeriod} locale={locale}>
              {formatDateTime(period.startsAt)} – {formatDateTime(period.endsAt)}
            </Detail>
            <Detail label={words.colPollingDay} locale={locale}>
              {formatDate(period.pollingDay)}
            </Detail>
            <Detail label={words.colSilence} locale={locale}>
              <span className="block">
                {formatDateTime(period.silenceStartsAt)} – {formatDateTime(period.silenceEndsAt)}
              </span>
              <span
                lang={locale}
                className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                  silence === 'active' ? 'bg-warning-bg text-warning' : 'bg-surface text-muted'
                }`}>
                {silence === 'active' ? <span aria-hidden="true">●</span> : null}
                {silenceText(silence, words)}
              </span>
            </Detail>
            <Detail label={words.declaredAt} locale={locale}>
              {formatDateTime(period.declaredAt)}
            </Detail>
            {period.closedAt ? (
              <Detail label={words.closedAt} locale={locale}>
                {formatDateTime(period.closedAt)}
              </Detail>
            ) : null}
          </dl>
        </section>

        <section aria-labelledby="source-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 id="source-heading" lang={locale} className="text-base font-bold">
              {words.sourceTitle}
            </h2>
            <SourceLabel text={words.sourceElectionCommission} locale={locale} />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label={words.fieldSourceReference} locale={locale}>
              <span className="font-mono">{period.sourceReference}</span>
            </Detail>
            <Detail label={words.fieldSourcePublishedAt} locale={locale}>
              {formatDateTime(period.sourcePublishedAt)}
            </Detail>
          </dl>
          <ExternalLink href={period.sourceUrl} text={words.sourceLink} newTab={dictionary.common.opensInNewTab} locale={locale} />
        </section>
      </div>

      <section aria-labelledby="notices-heading" className="flex flex-col gap-3">
        <h2 id="notices-heading" lang={locale} className="text-lg font-bold">
          {words.noticesTitle}
        </h2>
        {period.notices.length === 0 ? (
          <p lang={locale} className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
            {words.noticesEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {period.notices.map((notice) => (
              <li key={notice.id}>
                <NoticeCard notice={notice} periodId={period.id} words={words} newTab={dictionary.common.opensInNewTab} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {declared ? (
        <>
          {/* A new key after each published notice clears the form for the next one. */}
          <PublishNoticeForm key={period.notices.length} periodId={period.id} />
          <ClosePeriodForm periodId={period.id} words={words} problems={(one(query.problems) ?? '').split(',').filter(Boolean)} locale={locale} />
        </>
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

/** FR-ELX-004: the label is written out, so the source never depends on colour. */
function SourceLabel({ text, locale }: { text: string; locale: Locale }) {
  return (
    <span lang={locale} className="inline-flex w-fit items-center rounded border border-line bg-surface px-2 py-0.5 text-xs font-semibold">
      {text}
    </span>
  );
}

/** The API accepts only https links for sources; anything else is shown as text, never as a link. */
function ExternalLink({ href, text, newTab, locale }: { href: string; text: string; newTab: string; locale: Locale }) {
  if (!href.startsWith('https://')) return <p className="break-all font-mono text-xs text-muted">{href}</p>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-primary underline ${FOCUS}`}>
      <span lang={locale}>{text}</span>
      <span lang={locale} className="sr-only">
        {newTab}
      </span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function NoticeCard({ notice, periodId, words, newTab, locale }: { notice: ElectionNotice; periodId: string; words: Words; newTab: string; locale: Locale }) {
  const withdrawn = notice.withdrawnAt !== null;
  const other: Locale = locale === 'ta' ? 'en' : 'ta';
  return (
    <article aria-labelledby={`notice-${notice.id}`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <SourceLabel text={locale === 'ta' ? notice.labelTa : notice.labelEn} locale={locale} />
        <StateTag state={withdrawn ? 'withdrawn' : 'published'} />
      </div>
      <h3 id={`notice-${notice.id}`} lang={locale} className="text-base font-bold">
        {locale === 'ta' ? notice.titleTa : notice.titleEn}
      </h3>
      <p lang={locale} className="whitespace-pre-wrap text-sm leading-relaxed">
        {locale === 'ta' ? notice.bodyTa : notice.bodyEn}
      </p>
      <details className="rounded-lg border border-line bg-surface p-3 text-sm">
        <summary lang={locale} className={`min-h-11 cursor-pointer content-center font-semibold ${FOCUS}`}>
          {words.showOtherLanguage}
        </summary>
        <p lang={other} className="mt-2 font-bold">
          {other === 'ta' ? notice.titleTa : notice.titleEn}
        </p>
        <p lang={other} className="mt-1 whitespace-pre-wrap leading-relaxed">
          {other === 'ta' ? notice.bodyTa : notice.bodyEn}
        </p>
      </details>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Detail label={words.noticePublishedAt} locale={locale}>
          {formatDateTime(notice.publishedAt)}
        </Detail>
        {notice.sourcePublishedAt ? (
          <Detail label={words.noticeSourcePublishedAt} locale={locale}>
            {formatDateTime(notice.sourcePublishedAt)}
          </Detail>
        ) : null}
        {notice.documentReference ? (
          <Detail label={words.noticeDocument} locale={locale}>
            <span className="font-mono">{notice.documentReference}</span>
          </Detail>
        ) : null}
        {notice.withdrawnAt ? (
          <Detail label={words.noticeWithdrawn} locale={locale}>
            {formatDateTime(notice.withdrawnAt)}
          </Detail>
        ) : null}
      </dl>
      {notice.sourceUrl ? <ExternalLink href={notice.sourceUrl} text={words.noticeSourceLink} newTab={newTab} locale={locale} /> : null}
      {withdrawn ? null : (
        <form action={withdrawNotice} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="noticeId" value={notice.id} />
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" name="confirm" value="1" required className={`mt-0.5 h-5 w-5 shrink-0 accent-primary ${FOCUS}`} />
            <span lang={locale}>{words.confirmWithdrawNotice}</span>
          </label>
          <SubmitButton tone="danger">
            <span lang={locale}>{words.withdrawNotice}</span>
          </SubmitButton>
        </form>
      )}
    </article>
  );
}

function ClosePeriodForm({ periodId, words, problems, locale }: { periodId: string; words: Words; problems: string[]; locale: Locale }) {
  const actionProblem = problems.includes('close_action_required');
  const confirmProblem = problems.includes('confirmation_required');
  return (
    <form action={closePeriod} aria-labelledby="close-heading" className="flex flex-col gap-4 rounded-xl border border-error/50 bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-2">
        <h2 id="close-heading" lang={locale} className="text-base font-bold text-error">
          {words.closeTitle}
        </h2>
        <p lang={locale} className="text-sm text-muted">
          {words.closeIntro}
        </p>
      </div>
      <input type="hidden" name="periodId" value={periodId} />

      <fieldset className="flex flex-col gap-2" aria-describedby={actionProblem ? 'closeAction-error' : undefined}>
        <legend lang={locale} className="mb-1 text-sm font-semibold">
          {words.fieldCloseAction} <span aria-hidden="true">*</span>
        </legend>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 text-sm">
          <input id="input-closeAction" type="radio" name="closeAction" value="end" required className={`h-5 w-5 accent-primary ${FOCUS}`} />
          <span lang={locale}>{words.closeEnd}</span>
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 text-sm">
          <input type="radio" name="closeAction" value="withdraw" required className={`h-5 w-5 accent-primary ${FOCUS}`} />
          <span lang={locale}>{words.closeWithdraw}</span>
        </label>
        {actionProblem ? <FieldProblem id="closeAction-error" problem="close_action_required" locale={locale} /> : null}
      </fieldset>

      <FormField name="reason" label={words.fieldReason} hint={words.reasonHint} required problems={problems} locale={locale}>
        {(control) => <textarea {...control} required minLength={3} maxLength={500} rows={3} className={`${CONTROL} py-2`} />}
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
        <span lang={locale}>{words.confirmClose}</span>
      </label>

      <div className="flex justify-end">
        <SubmitButton tone="danger">
          <span lang={locale}>{words.submitClose}</span>
        </SubmitButton>
      </div>
    </form>
  );
}

function FieldProblem({ id, problem, locale }: { id: string; problem: string; locale: Locale }) {
  return (
    <p id={id} lang={locale} className="text-xs font-semibold text-error">
      ! {getLocalizedProblem(problem, locale)}
    </p>
  );
}
