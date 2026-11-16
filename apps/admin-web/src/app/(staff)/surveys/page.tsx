import { ApiError, type ManagedSurvey } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { RecordTable } from '@/components/RecordTable';
import { SURVEY_STATE_LABELS } from '@/features/surveys/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { countText } from '@/lib/formState';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const REFUSED = 'Surveys need the survey management permission (surveys.manage).';
const TONES = { draft: 'neutral', open: 'waiting', closed: 'done' } as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Surveys in the staff member's areas: drafts to finish, open ones taking answers, closed ones with results. */
export default function SurveysPage(props: PageProps<'/surveys'>) {
  return (
    <>
      <PageHeader ta="கருத்துக்கணிப்புகள்" en="Surveys">
        <Link href="/surveys/new" className={`inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS}`}>
          New survey
        </Link>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <SurveyList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SurveyList({ searchParams }: { searchParams: PageProps<'/surveys'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;

  let surveys: ManagedSurvey[];
  try {
    surveys = await (await staffApi()).listManagedSurveys();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Ideas and surveys are not switched on yet.</p>;
    }
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The survey list is not available." />;
  }
  const areaNames = await loadAreaNames(surveys.map((survey) => survey.areaKey));

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        The 100 most recent surveys in your areas, newest first. Results are counts only; any count under 10 shows as “fewer than 10”.
      </p>
      <RecordTable
        caption="Surveys"
        locale={locale}
        rows={surveys}
        rowKey={(survey) => survey.id}
        refHeader="Reference"
        href={(survey) => `/surveys/${survey.id}`}
        linkText={(survey) => survey.surveyRef}
        empty="No surveys in your areas yet."
        columns={[
          { header: 'State', cell: (survey) => <BilingualTag label={SURVEY_STATE_LABELS[survey.state]} tone={TONES[survey.state]} /> },
          { header: 'Title', cell: (survey) => <BilingualText ta={survey.titleTa} en={survey.titleEn} className="max-w-xs" /> },
          { header: 'Area', cell: (survey) => <span className="text-text">{areaText(survey.areaKey, areaNames, 'en')}</span> },
          {
            header: 'Answers',
            cell: (survey) => (
              <span className="flex flex-col text-xs">
                <span className="text-text">{survey.anonymous ? 'Anonymous' : survey.allowEdits ? 'Identified, may be changed' : 'Identified'}</span>
                <span className="tabular-nums text-muted">{survey.state === 'draft' ? '—' : `${countText(survey.responses)} responses`}</span>
              </span>
            ),
          },
          { header: 'Closes', cell: (survey) => <span className="text-xs tabular-nums text-muted">{survey.closesAt ? formatDateTime(survey.closesAt) : 'When closed by staff'}</span> },
        ]}
      />
    </div>
  );
}
