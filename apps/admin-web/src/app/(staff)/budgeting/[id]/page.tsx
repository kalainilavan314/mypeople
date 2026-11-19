import {
  ApiError,
  type BudgetCandidate,
  type BudgetRecount,
  type ManagedBudgetCycle,
  type ManagedBudgetProject,
  type ProposalCategory,
} from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import {
  addProject,
  allocateCycle,
  certifyCycle,
  moveCycle,
  placeProject,
  recordCompletion,
  recordExpenditure,
  recordReview,
  updateProject,
} from '@/features/budgeting/actions';
import { CycleForm } from '@/features/budgeting/CycleForm';
import {
  ALLOCATE,
  BUDGET_TARGETS,
  CERTIFY,
  CONSULTATION_LABEL,
  COUNTED,
  EDITABLE,
  FUND_KIND_LABELS,
  MANAGE,
  MOVES,
  MOVE_LABELS,
  PHASE_LABELS,
  REVIEW_KINDS,
  REVIEW_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  cycleValues,
  formatRupees,
  moneyTotals,
} from '@/features/budgeting/forms';
import { CATEGORY_LABELS } from '@/features/development/stages';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This budgeting cycle does not exist or is outside your areas.';
const REFUSED = 'Participatory budgeting needs budgeting management (pb.manage), certification (pb.certify) or the Treasurer’s finance approval (finance.approve).';
const ON_BALLOT = { ta: 'வாக்குச்சீட்டில் உள்ளது', en: 'On the ballot' };
const OFF_BALLOT = { ta: 'வாக்குச்சீட்டில் இல்லை', en: 'Not on the ballot' };
const FUNDED = { ta: 'நிதி வழங்கப்படும்', en: 'Funded' };
const NOT_FUNDED = { ta: 'நிதி வழங்கப்படாது', en: 'Not funded' };
const COMPLETED = { ta: 'நிறைவடைந்தது', en: 'Completed' };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const PROJECT_FIELDS: readonly FieldSpec[] = [
  { name: 'titleTa', label: 'Project title in Tamil', lang: 'ta', required: true, minLength: 5, maxLength: 220 },
  { name: 'titleEn', label: 'Project title in English', lang: 'en', required: true, minLength: 5, maxLength: 160 },
  { name: 'summaryTa', label: 'Summary for members in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 10, maxLength: 3000 },
  { name: 'summaryEn', label: 'Summary for members in English', kind: 'textarea', lang: 'en', required: true, minLength: 10, maxLength: 2000 },
  { name: 'estimatedCost', label: 'Estimated cost, in rupees', required: true, maxLength: 20, hint: 'For example 600,000.' },
];

const REVIEW_FIELDS: readonly FieldSpec[] = [
  {
    name: 'kind',
    label: 'Review',
    kind: 'radio',
    required: true,
    options: REVIEW_KINDS.map((kind) => ({ value: kind, label: `${REVIEW_LABELS[kind].ta} · ${REVIEW_LABELS[kind].en}` })),
  },
  { name: 'reference', label: 'Review reference', required: true, minLength: 3, maxLength: 200, hint: 'The review document or file number.', mono: true },
  { name: 'noteTa', label: 'What the review found, in Tamil (shown to members)', kind: 'textarea', lang: 'ta', required: true, minLength: 10, maxLength: 3000 },
  { name: 'noteEn', label: 'What the review found, in English (shown to members)', kind: 'textarea', lang: 'en', required: true, minLength: 10, maxLength: 2000 },
];

const EXPENDITURE_FIELDS: readonly FieldSpec[] = [
  { name: 'amount', label: 'Amount spent, in rupees', required: true, maxLength: 20 },
  { name: 'spentOn', label: 'Date spent', kind: 'date', required: true },
  { name: 'descriptionTa', label: 'What it paid for, in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 5, maxLength: 1500 },
  { name: 'descriptionEn', label: 'What it paid for, in English', kind: 'textarea', lang: 'en', required: true, minLength: 5, maxLength: 1000 },
  { name: 'evidenceRef', label: 'Evidence reference', required: true, minLength: 3, maxLength: 500, hint: 'Invoice, payment voucher or bank reference.', wide: true },
];

const COMPLETION_FIELDS: readonly FieldSpec[] = [
  { name: 'completedOn', label: 'Completed on', kind: 'date', required: true },
  { name: 'evidenceRef', label: 'Completion evidence', required: true, minLength: 3, maxLength: 500, hint: 'Completion certificate, photos or inspection report.' },
  { name: 'noteTa', label: 'Completion note in Tamil (shown to members)', kind: 'textarea', lang: 'ta', required: true, minLength: 10, maxLength: 3000 },
  { name: 'noteEn', label: 'Completion note in English (shown to members)', kind: 'textarea', lang: 'en', required: true, minLength: 10, maxLength: 2000 },
];

/** D19: one budgeting cycle, from its rules and projects to the certified count, allocations and spending. */
export default function BudgetCyclePage(props: PageProps<'/budgeting/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <CycleView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CycleView({ params, searchParams }: Pick<PageProps<'/budgeting/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/budgeting">Back to participatory budgeting</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  const client = await staffApi();
  let cycle: ManagedBudgetCycle;
  try {
    cycle = await client.getManagedBudgetCycle(id);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="Participatory budgeting" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }

  const can = (permission: string) => staff.permissions.has(permission);
  const editable = EDITABLE.includes(cycle.status);
  const counted = COUNTED.includes(cycle.status);
  const funded = cycle.projects.filter((project) => project.allocated !== null);
  const totals = moneyTotals(cycle.projects);
  const areaNames = await loadAreaNames([cycle.areaKey]);
  const moves = MOVES[cycle.status] ?? [];

  // Approved-for-planning proposals in the cycle's area, only while projects can still be added.
  let candidates: BudgetCandidate[] = [];
  if (editable && can(MANAGE)) {
    try {
      candidates = await client.listBudgetCandidates(cycle.id);
    } catch {
      candidates = [];
    }
  }
  // The recount is run on request (each run is audited), only after voting closes.
  let recount: BudgetRecount | null = null;
  let recountError: string | null = null;
  if (counted && one(query.recount) === '1' && (can(CERTIFY) || can(MANAGE))) {
    try {
      recount = await client.recountBudgetCycle(cycle.id);
    } catch (error) {
      recountError = error instanceof ApiError ? error.code : 'unavailable';
    }
  }

  const moveFields: FieldSpec[] = [
    {
      name: 'to',
      label: 'Next step',
      kind: 'radio',
      required: true,
      options: moves.map((move) => ({ value: move, label: `${MOVE_LABELS[move].ta} · ${MOVE_LABELS[move].en}` })),
    },
    { name: 'reason', label: 'Why the cycle is cancelled (shown to members)', kind: 'textarea', required: true, minLength: 10, maxLength: 1000, showWhen: { field: 'to', values: ['cancelled'] } },
  ];

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{cycle.cycleRef}</span>
          <BilingualTag label={STATUS_LABELS[cycle.status]} tone={STATUS_TONES[cycle.status]} />
          <BilingualTag label={PHASE_LABELS[cycle.phase]} />
          <BilingualTag label={FUND_KIND_LABELS[cycle.fundKind]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{cycle.titleTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {cycle.titleEn}
          </span>
        </h1>
        <p className="text-sm text-muted">
          {areaText(cycle.areaKey, areaNames, 'en')} · budget {formatRupees(cycle.budget)} · voting {formatDateTime(cycle.votingOpensAt)} to{' '}
          {formatDateTime(cycle.votingClosesAt)}
        </p>
        <p className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-3 text-sm">
          <span lang="ta" className="font-semibold text-text">{CONSULTATION_LABEL.ta}</span>
          <span lang="en" className="text-muted">{CONSULTATION_LABEL.en}</span>
        </p>
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section
            id="rules"
            ta="வெளியிடப்பட்ட விதிகள்"
            en="The published rules"
            intro={
              editable
                ? 'Members see these from publication. They can change until voting is scheduled; a change after publication publishes them again with a new date.'
                : 'Locked: the rules never change once voting is scheduled (BR-121).'
            }>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><Detail label="What members are asked to decide"><Both ta={cycle.rules.descriptionTa} en={cycle.rules.descriptionEn} /></Detail></div>
              <Detail label="Budget available"><span className="tabular-nums">{formatRupees(cycle.budget)}</span></Detail>
              <Detail label="Fund source"><Both ta={cycle.rules.fundSourceTa} en={cycle.rules.fundSourceEn} /></Detail>
              <div className="sm:col-span-2"><Detail label="Who may vote"><Both ta={cycle.rules.eligibilityTa} en={cycle.rules.eligibilityEn} /></Detail></div>
              <Detail label="Minimum age">{cycle.rules.minAge}</Detail>
              <Detail label="Projects each member may choose">{cycle.rules.maxChoices}</Detail>
              <Detail label="Rules published">{cycle.rules.rulesPublishedAt ? formatDateTime(cycle.rules.rulesPublishedAt) : 'Not yet: members cannot see the cycle'}</Detail>
              <Detail label="Voting">{formatDateTime(cycle.votingOpensAt)} to {formatDateTime(cycle.votingClosesAt)}</Detail>
              {cycle.rules.statusReason ? <div className="sm:col-span-2"><Detail label="Why it was cancelled">{cycle.rules.statusReason}</Detail></div> : null}
            </dl>
          </Section>

          <Section
            id="turnout"
            ta="பங்கேற்பு"
            en="Turnout"
            intro="How many took part, never who. No total per project is shown before voting closes and the count is rerun.">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <Detail label="Members who took part"><span className="tabular-nums">{cycle.participation}</span></Detail>
              <Detail label="Ballots in the chain"><span className="tabular-nums">{cycle.ballots}</span></Detail>
              <Detail label="Eligible when voting closed">
                {cycle.eligibleCount === null ? 'Counted when voting closes' : <span className="tabular-nums">{cycle.eligibleCount}</span>}
              </Detail>
            </dl>
          </Section>

          <Section
            id="projects"
            ta="திட்டங்கள்"
            en={`Projects (${cycle.projects.length})`}
            intro="Only development proposals approved for planning, each with an estimated cost and a recorded financial and legal review, can go on the ballot (FR-PBG-002). Members see only projects on the ballot.">
            {cycle.projects.length === 0 ? (
              <p className="text-sm text-muted">No projects yet. Add proposals approved for planning below.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {cycle.projects.map((project) => (
                  <ProjectItem key={project.id} cycle={cycle} project={project} manage={editable && can(MANAGE)} />
                ))}
              </ul>
            )}
          </Section>

          {editable && can(MANAGE) ? (
            <Section id="add-project" ta="திட்டத்தைச் சேர்த்தல்" en="Add a project" intro="From the development proposals approved for planning inside this cycle's area.">
              {candidates.length === 0 ? (
                <p className="text-sm text-muted">
                  No proposals approved for planning are waiting in this area. Proposals are approved for planning in{' '}
                  <Link href="/development" className={`font-semibold text-primary underline ${FOCUS_RING}`}>development proposals</Link>.
                </p>
              ) : (
                <SimpleForm
                  id="add-project"
                  action={addProject}
                  hidden={{ cycleId: cycle.id }}
                  fields={[
                    {
                      name: 'proposalId',
                      label: 'Proposal approved for planning',
                      kind: 'select',
                      required: true,
                      wide: true,
                      options: [
                        { value: '', label: 'Choose a proposal' },
                        ...candidates.map((candidate) => ({
                          value: candidate.id,
                          label: `${candidate.proposalRef} · ${candidate.title}${candidate.costEstimate ? ` · ${formatRupees(candidate.costEstimate)}` : ''}`,
                        })),
                      ],
                    },
                    ...PROJECT_FIELDS,
                  ]}
                  submits={[{ label: 'Add to the cycle' }]}
                  targets={BUDGET_TARGETS}
                />
              )}
            </Section>
          ) : null}

          {counted ? (
            <Section
              id="count"
              ta="எண்ணிக்கையும் சான்றுறுதியும்"
              en="Count and certification"
              intro="The count is rerun from the hash-chained ballots. Two different people with certification rights each certify the same recount; a mismatch with the participation records blocks certification.">
              {can(CERTIFY) || can(MANAGE) ? (
                <Link href={`/budgeting/${cycle.id}?recount=1#count`} className={`inline-flex min-h-11 w-fit items-center rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary ${FOCUS_RING}`}>
                  Rerun the count
                </Link>
              ) : null}
              {recountError ? <p className="text-sm font-semibold text-error">The count could not be rerun ({recountError.replace(/_/g, ' ')}).</p> : null}
              {recount ? <RecountPanel recount={recount} cycle={cycle} /> : null}
              <h3 className="text-sm font-bold text-text">Certifications ({cycle.certifications.length} of 2)</h3>
              {cycle.certifications.length === 0 ? (
                <p className="text-sm text-muted">Nobody has certified this count yet.</p>
              ) : (
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
                  {cycle.certifications.map((certification) => (
                    <li key={certification.certifiedAt}>
                      {formatDateTime(certification.certifiedAt)} · {certification.ballotCount} ballots · chain head{' '}
                      <span className="break-all font-mono text-xs">{certification.chainHead.slice(0, 16)}…</span>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          ) : null}

          {funded.length > 0 ? (
            <Section
              id="funded"
              ta="நிதி வழங்கப்பட்ட திட்டங்கள்"
              en={`Funded projects (${funded.length})`}
              intro={`Allocated ${formatRupees(totals.allocated)} of ${formatRupees(cycle.budget)}; spent ${formatRupees(totals.spent)}. Allocations and spending are kept in the finance records, append-only.`}>
              <ul className="flex flex-col divide-y divide-line">
                {funded.map((project) => (
                  <FundedItem key={project.id} cycle={cycle} project={project} manage={can(MANAGE)} />
                ))}
              </ul>
            </Section>
          ) : null}

          {editable && can(MANAGE) ? (
            <Section id="edit" ta="விதிகளை மாற்றுதல்" en="Change the rules" intro="Only before voting is scheduled.">
              <CycleForm cycleId={cycle.id} current={cycleValues(cycle)} />
            </Section>
          ) : null}
        </div>

        <aside aria-label="Next steps" className="flex flex-col gap-4">
          {moves.length > 0 && can(MANAGE) ? (
            <SimpleForm
              id="move"
              title="Next step for the cycle"
              intro={
                cycle.status === 'voting_open'
                  ? `Voting can be closed only after ${formatDateTime(cycle.votingClosesAt)}. Closing counts the eligible members and asks the certifiers to certify.`
                  : cycle.status === 'review'
                    ? 'Scheduling voting locks the rules and the ballot. It needs at least two projects on the ballot and an opening time after the rules were published.'
                    : cycle.status === 'draft'
                      ? 'Publishing shows the rules to members before voting opens (FR-PBG-001).'
                      : undefined
              }
              action={moveCycle}
              hidden={{ cycleId: cycle.id, status: cycle.status }}
              fields={moveFields}
              submits={[{ label: 'Record the step' }]}
              targets={BUDGET_TARGETS}
            />
          ) : null}
          {cycle.status === 'voting_closed' && can(CERTIFY) ? (
            <SimpleForm
              id="certify"
              title="Certify the count"
              intro="Your certification reruns the count. The second certification must come from a different person and reach the same totals; then the results are published as totals only."
              action={certifyCycle}
              hidden={{ cycleId: cycle.id }}
              fields={[]}
              submits={[{ label: 'Certify this count' }]}
              targets={BUDGET_TARGETS}
            />
          ) : null}
          {cycle.status === 'results_certified' && can(ALLOCATE) ? (
            <SimpleForm
              id="allocate"
              title="Record the allocations"
              intro="Each funded project receives its estimated cost from this cycle's fund, recorded in the finance records. This cannot be undone."
              action={allocateCycle}
              hidden={{ cycleId: cycle.id }}
              fields={[]}
              submits={[{ label: 'Record allocations' }]}
              targets={BUDGET_TARGETS}
            />
          ) : null}
          <p className="text-xs text-muted">
            Created {formatDate(cycle.createdAt)} · last changed {formatDateTime(cycle.updatedAt)}
          </p>
        </aside>
      </div>
    </>
  );
}

function ReviewLine({ label, review }: { label: { ta: string; en: string }; review: ManagedBudgetProject['financialReview'] }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface p-2">
      <p className="flex flex-wrap items-center gap-2">
        <BilingualTag label={label} tone={review ? 'done' : 'waiting'} />
        {review ? (
          <span className="text-xs text-muted">
            <span className="font-mono">{review.reference}</span> · {formatDate(review.recordedAt)}
          </span>
        ) : (
          <span className="text-xs text-muted">Not recorded yet</span>
        )}
      </p>
      {review ? <Both ta={review.noteTa} en={review.noteEn} /> : null}
    </div>
  );
}

function ProjectItem({ cycle, project, manage }: { cycle: ManagedBudgetCycle; project: ManagedBudgetProject; manage: boolean }) {
  const short = project.id.slice(0, 8);
  const category = CATEGORY_LABELS[project.category as ProposalCategory];
  const reviewed = project.financialReview !== null && project.legalReview !== null;
  return (
    <li className="flex flex-col gap-3 py-4 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-muted">{project.proposalRef}</span>
        <BilingualTag label={project.onBallot ? ON_BALLOT : OFF_BALLOT} tone={project.onBallot ? 'done' : 'neutral'} />
        {category ? <BilingualTag label={category} /> : null}
        {project.funded !== null ? <BilingualTag label={project.funded ? FUNDED : NOT_FUNDED} tone={project.funded ? 'done' : 'neutral'} /> : null}
        {project.rank !== null ? <span className="text-xs tabular-nums text-muted">rank {project.rank} · {project.votes ?? '—'} votes</span> : null}
      </p>
      <Both ta={project.titleTa} en={project.titleEn} />
      <p className="text-xs text-muted">Estimated cost <span className="tabular-nums">{formatRupees(project.estimatedCost)}</span></p>
      <details className="text-sm">
        <summary className={`min-h-11 cursor-pointer py-2 font-semibold text-primary ${FOCUS_RING}`}>The proposal and the summary for members</summary>
        <dl className="mt-2 grid gap-3">
          <Detail label="Summary for members"><Both ta={project.summaryTa} en={project.summaryEn} /></Detail>
          <Detail label="Problem (the author's words)">{project.problem}</Detail>
          <Detail label="Proposed solution">{project.solution}</Detail>
          <Detail label="Expected benefit">{project.benefit}</Detail>
        </dl>
      </details>
      <div className="grid gap-2 md:grid-cols-2">
        <ReviewLine label={REVIEW_LABELS.financial} review={project.financialReview} />
        <ReviewLine label={REVIEW_LABELS.legal} review={project.legalReview} />
      </div>
      {manage ? (
        <div className="flex flex-col gap-3">
          {project.onBallot ? (
            <SimpleForm id={`off-${short}`} action={placeProject} hidden={{ cycleId: cycle.id, projectId: project.id, onBallot: '0' }} fields={[]} submits={[{ label: 'Take off the ballot', tone: 'secondary' }]} targets={BUDGET_TARGETS} />
          ) : (
            <SimpleForm
              id={`on-${short}`}
              action={placeProject}
              hidden={{ cycleId: cycle.id, projectId: project.id, onBallot: '1' }}
              fields={[]}
              submits={[{ label: reviewed ? 'Put on the ballot' : 'Put on the ballot (needs both reviews)' }]}
              targets={BUDGET_TARGETS}
            />
          )}
          <details>
            <summary className={`min-h-11 cursor-pointer py-2 font-semibold text-primary ${FOCUS_RING}`}>Record a financial or legal review</summary>
            <SimpleForm id={`review-${short}`} action={recordReview} hidden={{ cycleId: cycle.id, projectId: project.id }} fields={REVIEW_FIELDS} submits={[{ label: 'Record the review' }]} targets={BUDGET_TARGETS} />
          </details>
          <details>
            <summary className={`min-h-11 cursor-pointer py-2 font-semibold text-primary ${FOCUS_RING}`}>Change the project</summary>
            <p className="mb-2 text-xs font-semibold text-warning">
              A new estimated cost clears the financial review and takes the project off the ballot until the review is recorded again.
            </p>
            <SimpleForm
              id={`edit-${short}`}
              action={updateProject}
              hidden={{ cycleId: cycle.id, projectId: project.id }}
              fields={PROJECT_FIELDS.map((field) => ({
                ...field,
                defaultValue: {
                  titleTa: project.titleTa,
                  titleEn: project.titleEn,
                  summaryTa: project.summaryTa,
                  summaryEn: project.summaryEn,
                  estimatedCost: Number(project.estimatedCost).toFixed(2),
                }[field.name],
              }))}
              submits={[{ label: 'Save the project', tone: 'secondary' }]}
              targets={BUDGET_TARGETS}
            />
          </details>
        </div>
      ) : null}
    </li>
  );
}

function RecountPanel({ recount, cycle }: { recount: BudgetRecount; cycle: ManagedBudgetCycle }) {
  const titles = new Map(cycle.projects.map((project) => [project.id, project]));
  const matches = recount.ballots === recount.participation;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-3 text-sm" role="status">
      <p className="flex flex-wrap gap-2">
        <BilingualTag
          label={recount.chainValid ? { ta: 'சங்கிலி சரியானது', en: 'Chain intact' } : { ta: 'சங்கிலி உடைந்துள்ளது', en: 'Chain broken' }}
          tone={recount.chainValid ? 'done' : 'refused'}
        />
        <BilingualTag
          label={matches ? { ta: 'பங்கேற்புடன் பொருந்துகிறது', en: 'Matches participation' } : { ta: 'பங்கேற்புடன் பொருந்தவில்லை', en: 'Does not match participation' }}
          tone={matches ? 'done' : 'refused'}
        />
        {recount.matchesCertified !== null ? (
          <BilingualTag
            label={recount.matchesCertified ? { ta: 'சான்றுறுதியுடன் பொருந்துகிறது', en: 'Matches the certified totals' } : { ta: 'சான்றுறுதியுடன் பொருந்தவில்லை', en: 'Differs from the certified totals' }}
            tone={recount.matchesCertified ? 'done' : 'refused'}
          />
        ) : null}
      </p>
      {recount.problem ? <p className="font-semibold text-error">Problem found: {recount.problem.replace(/_/g, ' ')}</p> : null}
      <p className="text-muted">
        {recount.ballots} ballots · {recount.participation} participation records · chain head{' '}
        <span className="break-all font-mono text-xs">{recount.chainHead}</span>
      </p>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Recounted totals per project</caption>
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th scope="col" className="py-1 pr-3">Project</th>
            <th scope="col" className="py-1 text-right">Votes</th>
          </tr>
        </thead>
        <tbody>
          {[...recount.totals].sort((a, b) => b.votes - a.votes).map((total) => (
            <tr key={total.projectId} className="border-b border-line last:border-0">
              <td className="py-1 pr-3">
                <span className="font-mono text-xs text-muted">{total.proposalRef}</span>{' '}
                <span lang="ta">{titles.get(total.projectId)?.titleTa ?? ''}</span>
              </td>
              <td className="py-1 text-right tabular-nums">{total.votes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundedItem({ cycle, project, manage }: { cycle: ManagedBudgetCycle; project: ManagedBudgetProject; manage: boolean }) {
  const short = project.id.slice(0, 8);
  const done = project.completion !== null;
  return (
    <li className="flex flex-col gap-3 py-4 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-muted">{project.proposalRef}</span>
        {done ? <BilingualTag label={COMPLETED} tone="done" /> : null}
      </p>
      <Both ta={project.titleTa} en={project.titleEn} />
      <p className="text-xs tabular-nums text-muted">
        Allocated {formatRupees(project.allocated)} · spent {formatRupees(project.spent)}
      </p>
      {project.expenditures.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {project.expenditures.map((item) => (
            <li key={item.id} className="rounded-lg bg-surface p-2">
              <p className="text-xs tabular-nums text-muted">
                {formatDate(item.spentOn)} · {formatRupees(item.amount)} · <span className="font-mono">{item.evidenceRef}</span>
              </p>
              <Both ta={item.descriptionTa} en={item.descriptionEn} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">No spending recorded yet.</p>
      )}
      {project.completion ? (
        <div className="rounded-lg bg-success-bg p-2">
          <p className="text-xs font-semibold text-success">
            Completed {formatDate(project.completion.completedOn)} · <span className="font-mono">{project.completion.evidenceRef}</span>
          </p>
          <Both ta={project.completion.noteTa} en={project.completion.noteEn} />
        </div>
      ) : null}
      {manage && !done ? (
        <div className="flex flex-col gap-2">
          <details>
            <summary className={`min-h-11 cursor-pointer py-2 font-semibold text-primary ${FOCUS_RING}`}>Record spending</summary>
            <SimpleForm id={`spend-${short}`} action={recordExpenditure} hidden={{ cycleId: cycle.id, projectId: project.id }} fields={EXPENDITURE_FIELDS} submits={[{ label: 'Record spending' }]} targets={BUDGET_TARGETS} />
          </details>
          <details>
            <summary className={`min-h-11 cursor-pointer py-2 font-semibold text-primary ${FOCUS_RING}`}>Record completion</summary>
            <SimpleForm id={`complete-${short}`} action={recordCompletion} hidden={{ cycleId: cycle.id, projectId: project.id }} fields={COMPLETION_FIELDS} submits={[{ label: 'Record completion' }]} targets={BUDGET_TARGETS} />
          </details>
        </div>
      ) : null}
    </li>
  );
}
