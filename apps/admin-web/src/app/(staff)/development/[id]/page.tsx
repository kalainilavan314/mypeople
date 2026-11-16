import { ApiError, type ProposalDetail } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { StageMoveForm } from '@/features/development/StageMoveForm';
import { CATEGORY_LABELS, NEXT_MOVES, STAGE_LABELS, STAGE_TONES } from '@/features/development/stages';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const NOT_FOUND = 'This proposal does not exist or is outside your areas.';
const REFUSED = 'Development proposals need content moderation, development review or planning approval.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** "Rs 2,500,000" from the API's decimal text; the text itself when it is not a number. */
function rupees(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `Rs ${amount.toLocaleString('en-LK', { maximumFractionDigits: 2 })}` : value;
}

/** D15: one proposal, its history with the tier that recorded each step, and the steps it may take next. */
export default function ProposalPage(props: PageProps<'/development/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <ProposalView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ProposalView({ params, searchParams }: Pick<PageProps<'/development/[id]'>, 'params' | 'searchParams'>) {
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
    <Link href="/development" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      ← Back to development proposals
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

  let proposal: ProposalDetail;
  try {
    proposal = await (await staffApi()).getManagedProposal(id);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return (
        <>
          {backLink}
          <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Development proposals are not switched on yet.</p>
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

  const areaNames = await loadAreaNames([proposal.areaKey]);
  const moves = NEXT_MOVES[proposal.stage];
  // Forms remount after every recorded step, so a finished form starts empty again.
  const version = `${proposal.updatedAt}-${proposal.history.length}`;

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{proposal.proposalRef}</span>
          <BilingualTag label={STAGE_LABELS[proposal.stage]} tone={STAGE_TONES[proposal.stage]} />
          <BilingualTag label={CATEGORY_LABELS[proposal.category]} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">{proposal.title}</h1>
        <p className="text-sm text-muted">
          {areaText(proposal.areaKey, areaNames, 'en')} · sent {formatDateTime(proposal.createdAt)}
          {proposal.revision > 1 ? ` · revision ${proposal.revision}` : ''}
          {proposal.publishedAt ? ` · published ${formatDateTime(proposal.publishedAt)}` : ''}
        </p>
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="proposal" title="The proposal" ta="முன்மொழிவு">
            <dl className="flex flex-col gap-4 text-sm">
              <Detail label="The problem">{proposal.problem}</Detail>
              <Detail label="Proposed solution">{proposal.solution}</Detail>
              <Detail label="Who benefits and how">{proposal.benefit}</Detail>
              <Detail label="Cost estimate">{proposal.costEstimate ? rupees(proposal.costEstimate) : 'Not given'}</Detail>
              <Detail label="Supporting evidence">{proposal.evidence || 'None given'}</Detail>
              {proposal.stageReason ? <Detail label="Decision reason shown to members">{proposal.stageReason}</Detail> : null}
            </dl>
            <p className="text-xs text-muted">AI topic and duplicate suggestions arrive after the AI provider decision (OD-42).</p>
          </Section>

          <Section id="history" title="History" ta="வரலாறு">
            <p className="text-sm text-muted">Each step names the tier that recorded it, never the person.</p>
            {proposal.history.length === 0 ? (
              <p className="text-sm text-muted">No steps recorded yet.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {proposal.history.map((entry, index) => (
                  <li key={`${entry.occurredAt}-${index}`} className="flex flex-col gap-1 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      {entry.fromStage ? (
                        <>
                          <BilingualTag label={STAGE_LABELS[entry.fromStage]} />
                          <span aria-hidden="true">→</span>
                          <span className="sr-only">to</span>
                        </>
                      ) : null}
                      <BilingualTag label={STAGE_LABELS[entry.toStage]} tone={STAGE_TONES[entry.toStage]} />
                    </p>
                    <p className="text-xs text-muted">
                      {entry.actorTier ? `Recorded by Tier ${entry.actorTier}` : entry.fromStage ? 'Recorded by the author' : 'Sent by the author'} ·{' '}
                      {formatDateTime(entry.occurredAt)}
                    </p>
                    {entry.reason ? <p className="whitespace-pre-wrap text-text">{entry.reason}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <aside aria-labelledby="next-heading" className="flex flex-col gap-4">
          <h2 id="next-heading" className="flex flex-col text-lg font-bold text-text">
            <span lang="ta">அடுத்த படிகள்</span>
            <span lang="en" className="text-sm font-semibold text-muted">
              Next steps
            </span>
          </h2>
          {proposal.mine ? (
            <p className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm font-semibold text-warning">
              ! This is your own proposal. Someone else records its steps.
            </p>
          ) : moves.length === 0 ? (
            <p className="text-sm text-muted">No further steps from this stage.</p>
          ) : (
            moves.map((move) => (
              <StageMoveForm
                key={`${move.to}-${version}`}
                proposalId={proposal.id}
                current={proposal.stage}
                move={move}
                held={staff.permissions.has(move.permission)}
              />
            ))
          )}
        </aside>
      </div>
    </>
  );
}

function Section({ id, title, ta, children }: { id: string; title: string; ta: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
      <h2 id={`${id}-heading`} className="flex flex-col text-lg font-bold text-text">
        <span lang="ta">{ta}</span>
        <span lang="en" className="text-sm font-semibold text-muted">
          {title}
        </span>
      </h2>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-text">{children}</dd>
    </div>
  );
}
