import type { AiModelFile, AiUsage } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Detail, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { colomboToday } from '@/features/assistant/forms';
import { makeModelLive, recordEvaluation, recordFairnessReview, retireModel } from '@/features/ai-models/actions';
import { DECISION_REASON_FIELDS, assistantEvaluationFields, fairnessFields, otherEvaluationFields } from '@/features/ai-models/fields';
import {
  APPROVE,
  FAIRNESS_LABELS,
  FAIRNESS_TONES,
  MODEL_TARGETS,
  PROVIDER_LABELS,
  REGISTRY_REFUSED,
  STATUS_LABELS,
  STATUS_TONES,
  TASK_LABELS,
  THRESHOLDS_TEXT,
  failureRate,
} from '@/features/ai-models/forms';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { bilingualProblemText } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This model is not in the registry.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D21: one model's registry entry, its monitoring, evaluations and fairness reviews, and its status. */
export default function AiModelPage(props: PageProps<'/ai-models/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <ModelView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

function UsageList({ usage, title }: { usage: AiUsage; title: string }) {
  const rate = failureRate(usage);
  const rows: [string, string][] = [
    ['Answers to members', String(usage.answers)],
    ['Answered from the sources', String(usage.answered)],
    ['No approved source', String(usage.noSource)],
    ['Declined under the rules', String(usage.refused)],
    ['Failed', `${usage.failed}${rate === null ? '' : ` (${rate}%)`}`],
    ['Average time to answer', usage.averageLatencyMs === null ? '—' : `${(usage.averageLatencyMs / 1000).toFixed(1)} s`],
    ['90% answered within', usage.p90LatencyMs === null ? '—' : `${(usage.p90LatencyMs / 1000).toFixed(1)} s`],
    ['Tokens in / out', `${usage.inputTokens.toLocaleString('en-GB')} / ${usage.outputTokens.toLocaleString('en-GB')}`],
    ['Staff previews (not shown to members)', String(usage.previews)],
  ];
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="tabular-nums text-text sm:text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function ModelView({ params, searchParams }: Pick<PageProps<'/ai-models/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/ai-models">Back to the model registry</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let file: AiModelFile;
  try {
    file = await (await staffApi()).getAiModel(id);
  } catch (error) {
    return (
      <>
        {backLink}
        <LoadFailure error={error} locale={locale} refused={REGISTRY_REFUSED} notFound={NOT_FOUND} />
      </>
    );
  }

  const { model } = file.summary;
  const today = colomboToday(new Date());
  const isAssistant = model.task === 'assistant';
  const approver = staff.permissions.has(APPROVE);
  const rollback = model.status === 'retired' && model.liveAt !== null;
  const problems = file.summary.goLiveProblems;
  const feedback = file.feedback30Days;

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <BilingualTag label={STATUS_LABELS[model.status]} tone={STATUS_TONES[model.status]} />
          <BilingualTag label={TASK_LABELS[model.task]} />
          <BilingualTag label={PROVIDER_LABELS[model.providerCode]} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          {model.name} <span className="font-mono text-lg text-muted">{model.version}</span>
        </h1>
        <p className="text-sm text-muted">
          <span className="font-mono">{model.modelRef}</span> · registered {formatDateTime(model.createdAt)} · in shadow mode since{' '}
          {formatDateTime(model.shadowStartedAt)}
          {model.liveAt ? ` · live from ${formatDateTime(model.liveAt)}` : ''}
          {model.retiredAt ? ` · retired ${formatDateTime(model.retiredAt)}` : ''}
        </p>
        {model.statusReason ? <p className="text-sm text-muted">Last status reason: {model.statusReason}</p> : null}
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="entry" ta="பதிவேட்டுப் பதிவு" en="Registry entry" intro="NFR-AI-01, DEP-24, OD-42">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Who runs it">{model.provider}</Detail>
              <Detail label="Where the data is processed">{model.dataLocation}</Detail>
              <Detail label="Licence">{model.licence}</Detail>
              <Detail label="Commercial use (DEP-24)">{model.licenceCommercialUse ? 'Allowed' : '! Not confirmed'}</Detail>
              <Detail label="No training on our data (OD-42)">{model.noTrainingTerms ? 'In the provider’s terms' : 'Not recorded'}</Detail>
              {model.artefactHash ? <Detail label="Artefact SHA-256"><span className="break-all font-mono text-xs">{model.artefactHash}</span></Detail> : null}
              <div className="sm:col-span-2">
                <Detail label="Training data summary">{model.trainingDataSummary}</Detail>
              </div>
              {model.notes ? (
                <div className="sm:col-span-2">
                  <Detail label="Notes">{model.notes}</Detail>
                </div>
              ) : null}
            </dl>
          </Section>

          <Section id="monitoring" ta="கண்காணிப்பு" en="Monitoring" intro="From the inference log: every answer records its model, outcome, sources and time, never the question or the answer (15B.8).">
            <div className="grid gap-6 md:grid-cols-2">
              <UsageList usage={file.usage7Days} title="Last 7 days" />
              <UsageList usage={file.summary.usage30Days} title="Last 30 days" />
            </div>
            <p className="text-sm text-text">
              Member ratings in the last 30 days: {feedback.helpful} helpful, {feedback.notHelpful} not helpful; {feedback.errorReports} error
              reports sent to the Knowledge Editor.
            </p>
          </Section>

          <Section id="evaluations" ta="மதிப்பீடுகள்" en={`Evaluations (${file.evaluations.length})`} intro={isAssistant ? THRESHOLDS_TEXT.en : 'Each evaluation is judged against the task’s own thresholds (15B.3).'}>
            {file.evaluations.length === 0 ? (
              <p className="text-sm text-muted">No evaluations yet. A model cannot go live without a passed evaluation from the last month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Evaluations</caption>
                  <thead className="border-b border-line text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-2 py-2">Date</th>
                      <th scope="col" className="px-2 py-2">Result</th>
                      {isAssistant ? (
                        <>
                          <th scope="col" className="px-2 py-2">Questions</th>
                          <th scope="col" className="px-2 py-2">Grounded</th>
                          <th scope="col" className="px-2 py-2">Unsupported</th>
                          <th scope="col" className="px-2 py-2">Persuasion / fabrication failures</th>
                        </>
                      ) : null}
                      <th scope="col" className="px-2 py-2">Summary and report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {file.evaluations.map((evaluation) => (
                      <tr key={evaluation.id}>
                        <td className="px-2 py-2 tabular-nums">{formatDate(evaluation.evaluatedOn)}</td>
                        <td className="px-2 py-2">
                          <BilingualTag label={evaluation.passed ? { ta: 'வெற்றி', en: 'Passed' } : { ta: 'தோல்வி', en: 'Failed' }} tone={evaluation.passed ? 'done' : 'refused'} />
                        </td>
                        {isAssistant ? (
                          <>
                            <td className="px-2 py-2 tabular-nums">{evaluation.questions ?? '—'}</td>
                            <td className="px-2 py-2 tabular-nums">{evaluation.groundedPct ?? '—'}%</td>
                            <td className="px-2 py-2 tabular-nums">{evaluation.unsupportedPct ?? '—'}%</td>
                            <td className="px-2 py-2 tabular-nums">
                              {evaluation.persuasionFailures ?? '—'} / {evaluation.fabricationFailures ?? '—'}
                            </td>
                          </>
                        ) : null}
                        <td className="px-2 py-2">
                          <p className="whitespace-pre-wrap text-text">{evaluation.summary}</p>
                          <p className="text-xs text-muted">Report: {evaluation.reportRef}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section id="fairness" ta="சமநிலை மீளாய்வுகள்" en={`Fairness reviews (${file.fairnessReviews.length})`} intro="Results compared across groups before going live and in each quarterly review (15B.5).">
            {file.fairnessReviews.length === 0 ? (
              <p className="text-sm text-muted">No fairness reviews yet. A model cannot go live without a passed one.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {file.fairnessReviews.map((review) => (
                  <li key={review.id} className="flex flex-col gap-1 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <BilingualTag label={FAIRNESS_LABELS[review.outcome]} tone={FAIRNESS_TONES[review.outcome]} />
                      <span className="text-xs tabular-nums text-muted">{formatDate(review.reviewedOn)}</span>
                    </p>
                    <p className="text-xs text-muted">Groups: {review.groups}</p>
                    <p className="whitespace-pre-wrap text-text">{review.findings}</p>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <aside aria-label="Governance actions" className="flex flex-col gap-4">
          <SimpleForm
            id="evaluation"
            title="Record an evaluation"
            intro={isAssistant ? `${THRESHOLDS_TEXT.en} The registry works out pass or fail.` : 'State the result against the task’s thresholds and where the report is.'}
            action={recordEvaluation}
            hidden={{ modelId: model.id, task: model.task }}
            fields={isAssistant ? assistantEvaluationFields(today) : otherEvaluationFields(today)}
            submits={[{ label: 'Record evaluation' }]}
            targets={MODEL_TARGETS}
          />
          <SimpleForm
            id="fairness-review"
            title="Record a fairness review"
            action={recordFairnessReview}
            hidden={{ modelId: model.id }}
            fields={fairnessFields(today)}
            submits={[{ label: 'Record review' }]}
            targets={MODEL_TARGETS}
          />
          {model.status !== 'live' ? (
            approver ? (
              <div className="flex flex-col gap-2">
                <div role="status" className={`flex flex-col gap-1 rounded-xl border p-4 text-sm ${problems.length > 0 ? 'border-warning bg-warning-bg text-warning' : 'border-line bg-card text-success'}`}>
                  {problems.length > 0 ? (
                    <>
                      <p className="font-semibold">
                        <span lang="ta">இன்னும் நேரடிப் பயன்பாட்டுக்கு வர முடியாது</span> · Not ready to go live yet
                      </p>
                      <ul className="flex list-disc flex-col gap-0.5 pl-5 text-xs">
                        {problems.map((problem) => (
                          <li key={problem}>
                            <span lang="ta">{bilingualProblemText(problem).ta}</span> · {bilingualProblemText(problem).en}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="font-semibold">
                      <span lang="ta">அனைத்துச் சோதனைகளும் வெற்றி</span> · Every check passes
                    </p>
                  )}
                </div>
                <SimpleForm
                  id="go-live"
                  title={rollback ? 'Roll back to this version' : 'Make live'}
                  intro={
                    rollback
                      ? 'This version was live before, so it goes live again at once (NFR-AI-07). The model live now for the same task is retired.'
                      : 'Needs a commercial licence, no-training terms for a hosted model, a passed evaluation from the last month, a passed fairness review and four weeks in shadow mode. The model live now for the same task is retired.'
                  }
                  action={makeModelLive}
                  hidden={{ modelId: model.id }}
                  fields={DECISION_REASON_FIELDS}
                  submits={[{ label: rollback ? 'Roll back' : 'Make live' }]}
                  targets={MODEL_TARGETS}
                />
              </div>
            ) : (
              <p className="rounded-xl border border-line bg-card p-4 text-sm text-muted">Making a model live needs ai.model.approve (PRM-30).</p>
            )
          ) : null}
          {model.status !== 'retired' && approver ? (
            <SimpleForm
              id="retire"
              title="Retire"
              intro={model.status === 'live' ? 'It stops answering at once. Its inference records are kept.' : 'It will not go live. Its records are kept.'}
              action={retireModel}
              hidden={{ modelId: model.id }}
              fields={DECISION_REASON_FIELDS}
              submits={[{ label: 'Retire', tone: 'danger' }]}
              targets={MODEL_TARGETS}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
