import type { AssistantErrorReport } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, FOCUS_RING, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { resolveErrorReport } from '@/features/assistant/actions';
import { AnswerView } from '@/features/assistant/AnswerView';
import { RESOLVE_FIELDS } from '@/features/assistant/fields';
import { ERROR_STATES, ERROR_STATE_LABELS, ERROR_STATE_TONES, KNOWLEDGE_REFUSED, SOURCE_TARGETS } from '@/features/assistant/forms';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FR-AIA-008: answers members reported as wrong, with the question, the answer and its citations. */
export default function ErrorReportsPage(props: PageProps<'/assistant/errors'>) {
  return (
    <>
      <BackLink href="/assistant">Back to the knowledge base</BackLink>
      <PageHeader ta="பிழை முறைப்பாடுகள்" en="Reported errors" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Reports searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<'/assistant/errors'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const state = ERROR_STATES.find((item) => item === one(query.state)) ?? 'open';
  let reports: AssistantErrorReport[];
  try {
    reports = await (await staffApi()).listAssistantErrorReports(state);
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={KNOWLEDGE_REFUSED} notFound="The error reports are not available." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <nav aria-label="Report state" className="flex flex-wrap gap-2">
        {ERROR_STATES.map((code) => (
          <Link
            key={code}
            href={`/assistant/errors?state=${code}`}
            aria-current={code === state ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${code === state ? 'border-primary bg-surface text-primary' : 'border-line bg-card text-text'} ${FOCUS_RING}`}>
            {ERROR_STATE_LABELS[code].ta} · {ERROR_STATE_LABELS[code].en}
          </Link>
        ))}
      </nav>
      <Section
        id="reports"
        ta="அறிவுத் தொகுப்பாளரின் வரிசை"
        en={`Knowledge Editor queue (${reports.length})`}
        intro="Fix the source when the answer was wrong (draft a new version), then close the report. Who reported it is never shown.">
        {reports.length === 0 ? (
          <p className="text-sm text-muted">{state === 'open' ? 'No open error reports.' : 'No reports in this state.'}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-col gap-3 rounded-lg border border-line p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <BilingualTag label={ERROR_STATE_LABELS[report.state]} tone={ERROR_STATE_TONES[report.state]} />
                  <span className="text-xs tabular-nums text-muted">reported {formatDateTime(report.createdAt)}</span>
                  {report.modelName ? <span className="text-xs text-muted">· answered by {report.modelName}</span> : null}
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted">
                    <span lang="ta">உறுப்பினரின் கேள்வி</span> · The member’s question (identifiers removed)
                  </p>
                  <p className="whitespace-pre-wrap text-text">{report.question}</p>
                </div>
                <AnswerView body={report.answer} citations={report.citations} />
                <div className="flex flex-col gap-1 rounded-lg border border-warning bg-warning-bg p-3">
                  <p className="text-xs font-semibold text-warning">
                    <span lang="ta">என்ன பிழை என உறுப்பினர் கூறியது</span> · What the member says is wrong
                  </p>
                  <p className="whitespace-pre-wrap text-text">{report.note}</p>
                </div>
                {report.state === 'open' ? (
                  <SimpleForm
                    id={`resolve-${report.id.slice(0, 8)}`}
                    action={resolveErrorReport}
                    hidden={{ reportId: report.id }}
                    fields={RESOLVE_FIELDS}
                    submits={[{ label: 'Close the report' }]}
                    targets={SOURCE_TARGETS}
                  />
                ) : (
                  <p className="text-xs text-muted">
                    {report.resolvedByName ?? 'Closed'} · {formatDateTime(report.resolvedAt)}: {report.resolution}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
