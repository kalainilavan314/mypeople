import type { AiRegistry } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, FOCUS_RING, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import {
  FAIRNESS_LABELS,
  FAIRNESS_TONES,
  PROVIDER_LABELS,
  REGISTRY_REFUSED,
  STATUS_LABELS,
  STATUS_TONES,
  TASK_LABELS,
  failureRate,
} from '@/features/ai-models/forms';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { bilingualProblemText } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const LINK = `inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary ${FOCUS_RING}`;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D21: every AI model in use, its licence and data terms, evaluations, fairness reviews and use. */
export default function AiModelsPage(props: PageProps<'/ai-models'>) {
  return (
    <>
      <PageHeader ta="AI மாதிரிகள் பதிவேடு" en="AI model registry">
        <div className="flex flex-wrap gap-2">
          <Link href="/assistant/try" className={LINK}>
            Try the assistant
          </Link>
          <ButtonLink href="/ai-models/new">Register a model</ButtonLink>
        </div>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Registry searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Registry({ searchParams }: { searchParams: PageProps<'/ai-models'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  let registry: AiRegistry;
  try {
    registry = await (await staffApi()).getAiRegistry();
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={REGISTRY_REFUSED} notFound="The model registry is not available." />;
  }
  const { configured } = registry;

  return (
    <div className="flex flex-col gap-6">
      <Feedback done={one(query.done)} />
      <Section
        id="configured"
        ta="சேவையக அமைப்பு"
        en="What this server is set up to call for the assistant"
        intro="Members are answered only by a live registry entry with the same provider and model id (15B.5). Changing the provider is a server setting, not a dashboard action.">
        {configured.provider === 'none' ? (
          <p className="flex flex-col gap-1 text-sm text-text">
            <span lang="ta">AI வழங்குநர் அமைக்கப்படவில்லை (AI_PROVIDER=none). எதுவும் வெளியே அனுப்பப்படுவதில்லை; உதவியாளர் &quot;இன்னும் கிடைக்கவில்லை&quot; என்று கூறும்.</span>
            <span lang="en" className="text-muted">
              No AI provider is set up (AI_PROVIDER=none). Nothing is sent anywhere, and the assistant tells members it is not available yet. OD-42 (AI provider and hosting) is still open.
            </span>
          </p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold text-muted">Provider</dt>
              <dd className="mt-1 text-text">{configured.provider}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">Model id</dt>
              <dd className="mt-1 font-mono text-text">{configured.modelRef}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">In the registry</dt>
              <dd className="mt-1">
                {configured.registeredModelId && configured.registeredStatus ? (
                  <Link href={`/ai-models/${configured.registeredModelId}`} className={`text-primary underline ${FOCUS_RING}`}>
                    <BilingualTag label={STATUS_LABELS[configured.registeredStatus]} tone={STATUS_TONES[configured.registeredStatus]} />
                  </Link>
                ) : (
                  <span className="text-warning">Not registered: register it before staff can try it or members can use it.</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </Section>

      <Section id="models" ta="மாதிரிகள்" en={`Models (${registry.models.length})`} intro="A new entry starts in shadow mode. One model is live per task; making another live retires the one before.">
        <RecordTable
          caption="AI models"
          locale={locale}
          rows={registry.models}
          rowKey={(row) => row.model.id}
          refHeader="Version"
          href={(row) => `/ai-models/${row.model.id}`}
          linkText={(row) => row.model.version}
          empty="No models are registered yet."
          columns={[
            { header: 'Status', cell: (row) => <BilingualTag label={STATUS_LABELS[row.model.status]} tone={STATUS_TONES[row.model.status]} /> },
            {
              header: 'Model and task',
              cell: (row) => (
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-text">{row.model.name}</span>
                  <span className="font-mono text-xs text-muted">{row.model.modelRef}</span>
                  <BilingualText ta={TASK_LABELS[row.model.task].ta} en={TASK_LABELS[row.model.task].en} className="text-xs" />
                </span>
              ),
            },
            {
              header: 'Provider and terms',
              cell: (row) => (
                <span className="flex flex-col gap-0.5 text-xs">
                  <span className="text-text">{PROVIDER_LABELS[row.model.providerCode].en}</span>
                  <span className={row.model.licenceCommercialUse ? 'text-muted' : 'font-semibold text-error'}>
                    {row.model.licenceCommercialUse ? 'Commercial use allowed' : '! Commercial use not confirmed'}
                  </span>
                  <span className="text-muted">{row.model.noTrainingTerms ? 'No training on our data' : 'No-training terms not recorded'}</span>
                </span>
              ),
            },
            {
              header: 'Evaluation and fairness',
              cell: (row) => (
                <span className="flex flex-col gap-1 text-xs">
                  {row.latestEvaluation ? (
                    <BilingualTag
                      label={row.latestEvaluation.passed ? { ta: 'மதிப்பீடு வெற்றி', en: `Evaluation passed ${formatDate(row.latestEvaluation.evaluatedOn)}` } : { ta: 'மதிப்பீடு தோல்வி', en: `Evaluation failed ${formatDate(row.latestEvaluation.evaluatedOn)}` }}
                      tone={row.latestEvaluation.passed ? 'done' : 'refused'}
                    />
                  ) : (
                    <span className="text-muted">No evaluation yet</span>
                  )}
                  {row.latestFairness ? (
                    <BilingualTag label={FAIRNESS_LABELS[row.latestFairness.outcome]} tone={FAIRNESS_TONES[row.latestFairness.outcome]} />
                  ) : (
                    <span className="text-muted">No fairness review yet</span>
                  )}
                </span>
              ),
            },
            {
              header: 'Last 30 days',
              cell: (row) => {
                const rate = failureRate(row.usage30Days);
                return (
                  <span className="flex flex-col text-xs tabular-nums text-muted">
                    <span>{row.usage30Days.answers} answers to members</span>
                    <span>{rate === null ? 'no failures to count' : `${rate}% failed`}</span>
                    <span>{row.usage30Days.previews} staff previews</span>
                  </span>
                );
              },
            },
            {
              header: 'Can it go live?',
              cell: (row) =>
                row.model.status === 'live' ? (
                  <span className="text-xs text-success">Live since {formatDate(row.model.liveAt)}</span>
                ) : row.goLiveProblems.length === 0 ? (
                  <span className="text-xs text-success">Ready: every check passes</span>
                ) : (
                  <ul className="flex max-w-xs list-disc flex-col gap-0.5 pl-4 text-xs text-muted">
                    {row.goLiveProblems.map((problem) => (
                      <li key={problem}>{bilingualProblemText(problem).en}</li>
                    ))}
                  </ul>
                ),
            },
          ]}
        />
      </Section>
    </div>
  );
}
