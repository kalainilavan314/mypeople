import { ApiError, type SurveyResults } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { KIND_LABELS, SURVEY_STATE_LABELS, resultRows } from '@/features/surveys/forms';
import { api } from '@/lib/api';
import { countText, countTextTa } from '@/lib/formState';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const NOT_FOUND = 'This survey does not exist or is outside your areas.';
const REFUSED = 'Survey results need the survey management permission (surveys.manage).';
const TONES = { draft: 'neutral', open: 'waiting', closed: 'done' } as const;

/**
 * FR-SRV-006, BR-045: counts only. Any count from 1 to 9 shows as "fewer than 10", and written
 * answers are counted, never shown. Opening this page is recorded in the audit log.
 */
export default function SurveyResultsPage(props: PageProps<'/surveys/[id]/results'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <Results params={props.params} />
    </Suspense>
  );
}

function Count({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="flex flex-col text-xs text-muted">
        <span lang="ta">{countTextTa(value)}</span>
        <span lang="en">{countText(value)}</span>
      </span>
    );
  }
  return <span className="font-semibold tabular-nums text-text">{countText(value)}</span>;
}

async function Results({ params }: Pick<PageProps<'/surveys/[id]/results'>, 'params'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const backLink = (
    <Link href={UUID.test(id) ? `/surveys/${id}` : '/surveys'} className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      ← Back to the survey
    </Link>
  );
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }

  let results: SurveyResults;
  try {
    results = await (await staffApi()).getSurveyResults(id);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return (
        <>
          {backLink}
          <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Ideas and surveys are not switched on yet.</p>
        </>
      );
    }
    return (
      <>
        {backLink}
        <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
      </>
    );
  }
  const { survey } = results;

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{survey.surveyRef}</span>
          <BilingualTag label={SURVEY_STATE_LABELS[survey.state]} tone={TONES[survey.state]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{survey.titleTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            Results · {survey.titleEn}
          </span>
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          Responses: <Count value={results.responses} />
        </p>
      </header>

      <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-text">
        Counts only. Any count from 1 to 9 shows as “fewer than 10” so a small group cannot be singled out. Written answers are
        counted here, never shown.
      </p>

      <ol className="flex flex-col gap-4">
        {results.questions.map((result, index) => {
          const rows = resultRows(result.question, result.counts);
          return (
            <li key={result.question.id}>
              <section aria-labelledby={`question-${index + 1}`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
                <h2 id={`question-${index + 1}`} className="flex flex-col font-bold text-text">
                  <span className="text-xs font-semibold text-muted">
                    Question {index + 1} · {KIND_LABELS[result.question.kind].en}
                    {result.question.sensitive ? ' · sensitive' : ''}
                  </span>
                  <span lang="ta">{result.question.promptTa}</span>
                  <span lang="en" className="text-sm font-medium text-muted">
                    {result.question.promptEn}
                  </span>
                </h2>
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  Answered: <Count value={result.answered} />
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Counts for question {index + 1}</caption>
                    <thead className="border-b border-line text-xs">
                      <tr>
                        <th scope="col" className="py-2 pr-3 font-semibold text-text">
                          Answer
                        </th>
                        <th scope="col" className="py-2 font-semibold text-text">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((row) => (
                        <tr key={row.key}>
                          <th scope="row" className="py-2 pr-3 font-normal">
                            <span lang="ta" className="block text-text">
                              {row.ta}
                            </span>
                            {row.en !== row.ta ? (
                              <span lang="en" className="block text-xs text-muted">
                                {row.en}
                              </span>
                            ) : null}
                          </th>
                          <td className="py-2">
                            <Count value={row.count} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </li>
          );
        })}
      </ol>
    </>
  );
}
