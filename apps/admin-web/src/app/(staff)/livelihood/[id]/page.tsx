import { ApiError, type GuideEntryManagedDetail } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { markGuideVerified, requestGuideReview, resolveGuideReport, reviewGuideEntry, withdrawGuideEntry } from '@/features/livelihood/actions';
import { EntryForm } from '@/features/livelihood/EntryForm';
import { RESOLUTION_FIELDS, REVIEW_FIELDS, WITHDRAW_FIELDS } from '@/features/livelihood/fields';
import {
  CATEGORY_LABELS,
  EXPIRED_LABEL,
  GUIDE_TARGETS,
  REPORT_REASON_LABELS,
  REPORT_STATE_LABELS,
  REVERIFY_LABEL,
  STATE_LABELS,
  STATE_TONES,
  formValues,
  renameProblems,
} from '@/features/livelihood/forms';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { bilingualProblemText } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This guide entry does not exist.';
const REFUSED = 'The livelihood guide needs guide editing or guide review.';
const REPORT_TONES = { open: 'waiting', fixed: 'done', dismissed: 'neutral' } as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D28: one entry, what still stops its publication, its review, re-checks and the members' reports about it. */
export default function GuideEntryPage(props: PageProps<'/livelihood/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <EntryView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function EntryView({ params, searchParams }: Pick<PageProps<'/livelihood/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/livelihood">Back to the livelihood guide</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let entry: GuideEntryManagedDetail;
  try {
    entry = await (await staffApi()).getManagedGuideEntry(id);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="The livelihood guide" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }

  const edits = staff.permissions.has('guide.edit');
  const reviews = staff.permissions.has('guide.review');
  const ownEntry = entry.reviewRequestedByMe || entry.lastChangedByMe;
  const openReports = entry.reports.filter((report) => report.state === 'open');

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{entry.entryRef}</span>
          <BilingualTag label={STATE_LABELS[entry.state]} tone={STATE_TONES[entry.state]} />
          {entry.expired ? <BilingualTag label={EXPIRED_LABEL} tone="refused" /> : null}
          {entry.needsReverification ? <BilingualTag label={REVERIFY_LABEL} tone="waiting" /> : null}
          <BilingualTag label={CATEGORY_LABELS[entry.category]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{entry.titleTa || '(no Tamil title yet)'}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {entry.titleEn || '(no English title yet)'}
          </span>
        </h1>
        <p className="text-sm text-muted">
          last changed {formatDateTime(entry.updatedAt)}
          {entry.publishedAt ? ` · published ${formatDateTime(entry.publishedAt)}` : ''}
          {entry.openReports > 0 ? ` · ${entry.openReports} open report${entry.openReports === 1 ? '' : 's'}` : ''}
        </p>
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="entry" ta="பதிவு" en="The entry as members would read it">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><Detail label="Summary"><Both ta={entry.summaryTa} en={entry.summaryEn} /></Detail></div>
              <div className="sm:col-span-2"><Detail label="Details and how to apply"><Both ta={entry.bodyTa} en={entry.bodyEn} /></Detail></div>
              <Detail label="Provider"><Both ta={entry.providerTa} en={entry.providerEn} /></Detail>
              <Detail label="Public contact of the office">{entry.contact || '—'}</Detail>
              <div className="sm:col-span-2">
                <Detail label="Source link">
                  {entry.sourceUrl ? (
                    <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className={`break-all font-mono text-primary underline ${FOCUS_RING}`}>
                      {entry.sourceUrl}
                    </a>
                  ) : (
                    '—'
                  )}
                </Detail>
              </div>
              <Detail label="Published by the provider">{formatDate(entry.publishedOn)}</Detail>
              <Detail label="Last checked against the source">{formatDate(entry.verifiedOn)}</Detail>
              <Detail label="End date">{entry.expiresOn ? formatDate(entry.expiresOn) : 'None'}</Detail>
            </dl>
            <p className="rounded-lg bg-surface p-3 text-xs text-muted">
              Members always see this entry with the notice that the guide does not decide who qualifies and that they should check
              eligibility with the provider.
            </p>
            {entry.reviewNote ? (
              <p className="text-sm text-text">
                <span className="font-semibold">Reviewer’s note:</span> {entry.reviewNote}
              </p>
            ) : null}
            {entry.withdrawnReason ? (
              <p className="text-sm text-text">
                <span className="font-semibold">Withdrawn because:</span> {entry.withdrawnReason}
              </p>
            ) : null}
          </Section>

          <Section id="reports" ta="இப்பதிவு பற்றிய முறைப்பாடுகள்" en={`Members’ reports about this entry (${entry.reports.length})`} intro="The reporter is never named. They are told when the report is resolved.">
            {entry.reports.length === 0 ? (
              <p className="text-sm text-muted">No member has reported this entry.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {entry.reports.map((report) => (
                  <li key={report.id} className="flex flex-col gap-2 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <BilingualTag label={REPORT_STATE_LABELS[report.state]} tone={REPORT_TONES[report.state]} />
                      <BilingualTag label={REPORT_REASON_LABELS[report.reason]} />
                      <span className="text-xs tabular-nums text-muted">reported {formatDateTime(report.createdAt)}</span>
                    </p>
                    {report.note ? <p className="whitespace-pre-wrap text-text">“{report.note}”</p> : null}
                    {report.resolutionNote ? <p className="text-xs text-muted">Outcome note: {report.resolutionNote}</p> : null}
                    {report.state === 'open' && edits ? (
                      <SimpleForm
                        id={`report-${report.id.slice(0, 8)}`}
                        action={resolveGuideReport}
                        hidden={{ reportId: report.id, entryId: entry.id }}
                        fields={RESOLUTION_FIELDS}
                        submits={[{ label: 'Record outcome' }]}
                        targets={GUIDE_TARGETS}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {edits && entry.state !== 'withdrawn' ? (
            <Section
              id="edit"
              ta="பதிவை மாற்றுதல்"
              en="Change the entry"
              intro={
                entry.state === 'published'
                  ? 'Saving a change takes the entry off the guide until a second person reviews it again. To record only that you checked it, use “Checked today” instead.'
                  : 'Drafts save even when incomplete. Ask for review when every field is filled in both languages.'
              }>
              <EntryForm entryId={entry.id} current={formValues(entry)} published={entry.state === 'published'} />
            </Section>
          ) : null}
        </div>

        <aside aria-label="Review and publication" className="flex flex-col gap-4">
          {entry.missing.length > 0 ? (
            <section aria-labelledby="missing-heading" className="flex flex-col gap-2 rounded-2xl border border-line bg-card shadow-card p-4 text-sm">
              <h2 id="missing-heading" className="font-bold text-text">
                <span lang="ta">வெளியிடுவதற்கு முன் தேவை</span> · Needed before publication
              </h2>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-text">
                {renameProblems(entry.missing).map((problem) => (
                  <li key={problem}>{bilingualProblemText(problem).en}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {entry.state === 'draft' && edits ? (
            <SimpleForm
              id="request-review"
              title="Ask for review"
              intro="A second person with guide review publishes it. Review is refused while anything above is missing."
              action={requestGuideReview}
              hidden={{ entryId: entry.id }}
              fields={[]}
              submits={[{ label: 'Ask for review' }]}
              targets={GUIDE_TARGETS}
            />
          ) : null}
          {entry.state === 'in_review' && reviews ? (
            ownEntry ? (
              <p className="rounded-2xl border border-line bg-card shadow-card p-4 text-sm text-muted">
                You asked for this review or made the last change, so another reviewer must decide it (FR-LIV-003). The API refuses
                your decision as “own entry”.
              </p>
            ) : (
              <SimpleForm
                id="review"
                title="Review decision"
                intro="Check the wording against the source in both languages. Neither the person who asked nor the one who last changed it may publish it."
                action={reviewGuideEntry}
                hidden={{ entryId: entry.id }}
                fields={REVIEW_FIELDS}
                submits={[{ label: 'Record decision' }]}
                targets={GUIDE_TARGETS}
              />
            )
          ) : null}
          {entry.state === 'in_review' && !reviews ? (
            <p className="rounded-2xl border border-line bg-card shadow-card p-4 text-sm text-muted">Waiting for someone with guide review to publish it or return it.</p>
          ) : null}
          {entry.state === 'published' && edits ? (
            <SimpleForm
              id="verified"
              title="Checked today"
              intro="You checked the entry against its source today and nothing changed. Members see the new “last verified” date."
              action={markGuideVerified}
              hidden={{ entryId: entry.id }}
              fields={[]}
              submits={[{ label: 'Mark as checked today', tone: 'secondary' }]}
              targets={GUIDE_TARGETS}
            />
          ) : null}
          {entry.state !== 'withdrawn' && (edits || reviews) ? (
            <SimpleForm
              id="withdraw"
              title="Withdraw from the guide"
              intro="For a scheme that ended early or an entry that was wrong. The record and its reports are kept."
              action={withdrawGuideEntry}
              hidden={{ entryId: entry.id }}
              fields={WITHDRAW_FIELDS}
              submits={[{ label: 'Withdraw entry', tone: 'danger' }]}
              targets={GUIDE_TARGETS}
            />
          ) : null}
          {openReports.length > 0 && !edits ? (
            <p className="rounded-2xl border border-line bg-card shadow-card p-4 text-sm text-muted">An editor with guide editing resolves the open reports.</p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
