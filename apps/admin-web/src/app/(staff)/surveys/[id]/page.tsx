import { ApiError, type ManagedSurveyFile } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { KIND_LABELS, SURVEY_STATE_LABELS } from '@/features/surveys/forms';
import { SurveyForm } from '@/features/surveys/SurveyForm';
import { SurveyStateForm } from '@/features/surveys/SurveyStateForm';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime, toSriLankaDateTimeInput } from '@/lib/format';
import { countText } from '@/lib/formState';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const NOT_FOUND = 'This survey does not exist or is outside your areas.';
const REFUSED = 'Surveys need the survey management permission (surveys.manage).';
const TONES = { draft: 'neutral', open: 'waiting', closed: 'done' } as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** One survey: its settings, open or close, and for a draft the form that replaces it. */
export default function SurveyPage(props: PageProps<'/surveys/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <SurveyView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SurveyView({ params, searchParams }: Pick<PageProps<'/surveys/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = (
    <Link href="/surveys" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      ← Back to surveys
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

  const client = await staffApi();
  let survey: ManagedSurveyFile;
  try {
    survey = await client.getManagedSurvey(id);
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
  const { questions } = survey;
  const areaNames = await loadAreaNames([survey.areaKey]);
  const areaName = `${areaText(survey.areaKey, areaNames, 'en')} · ${areaText(survey.areaKey, areaNames, 'ta')}`;
  const current: Record<string, string> = {
    titleTa: survey.titleTa,
    titleEn: survey.titleEn,
    audienceTa: survey.audienceTa,
    audienceEn: survey.audienceEn,
    privacyTa: survey.privacyTa,
    privacyEn: survey.privacyEn,
    nextStepsTa: survey.nextStepsTa,
    nextStepsEn: survey.nextStepsEn,
    closesAt: toSriLankaDateTimeInput(survey.closesAt),
    anonymous: survey.anonymous ? '1' : '',
    allowEdits: survey.allowEdits ? '1' : '',
    questionsJson: JSON.stringify(
      questions.map((question) => ({
        kind: question.kind,
        promptTa: question.promptTa,
        promptEn: question.promptEn,
        options: question.options,
        sensitive: question.sensitive,
        required: question.required,
      })),
    ),
  };

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
            {survey.titleEn}
          </span>
        </h1>
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="settings" title="Settings">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Area">{areaName}</Detail>
              <Detail label="Answers">
                {survey.anonymous
                  ? 'Anonymous: stored with no link to the member, and cannot be changed'
                  : survey.allowEdits
                    ? 'Identified: members may change their answer while it is open'
                    : 'Identified: one answer each'}
              </Detail>
              <Detail label="Closes">{survey.closesAt ? formatDateTime(survey.closesAt) : 'When closed by staff'}</Detail>
              <Detail label="Responses">{survey.state === 'draft' ? 'Not open yet' : countText(survey.responses)}</Detail>
              <Detail label="Created">{formatDateTime(survey.createdAt)}</Detail>
            </dl>
            {survey.state === 'draft' ? null : (
              <Link href={`/surveys/${survey.id}/results`} className={`inline-flex min-h-11 w-fit items-center font-semibold text-primary underline ${FOCUS}`}>
                See the results
              </Link>
            )}
          </Section>

          {survey.state === 'draft' ? (
            <Section
              id="edit"
              title="Change the draft"
              intro="Saving replaces the whole draft: its texts, settings and questions.">
              <SurveyForm surveyId={survey.id} current={current} fixedArea={survey.areaKey} fixedAreaName={areaName} />
            </Section>
          ) : (
            <Section id="questions" title="Questions" intro="An open or closed survey cannot change. Counts are on the results page.">
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                {questions.map((question) => (
                  <li key={question.id}>
                    <span lang="ta" className="block text-text">
                      {question.promptTa}
                    </span>
                    <span lang="en" className="block text-muted">
                      {question.promptEn} · {KIND_LABELS[question.kind].en}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>

        <aside aria-label="State" className="flex flex-col gap-4">
          <SurveyStateForm surveyId={survey.id} state={survey.state} />
          {survey.state === 'draft' && questions.length > 0 ? (
            <div className="rounded-xl border border-line bg-card p-4 text-sm">
              <h2 className="font-semibold text-text">Saved questions ({questions.length})</h2>
              <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-muted">
                {questions.map((question) => (
                  <li key={question.id}>
                    <span lang="ta" className="block text-text">
                      {question.promptTa}
                    </span>
                    <span className="text-xs">{KIND_LABELS[question.kind].en}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={`${id}-section`} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="text-lg font-bold text-text">
          {title}
        </h2>
        {intro ? <p className="text-sm text-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-text">{children}</dd>
    </div>
  );
}
