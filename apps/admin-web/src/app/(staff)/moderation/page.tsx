import { ApiError, type PendingIdea, type ProposalSummary } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { CATEGORY_LABELS } from '@/features/development/stages';
import { ModerationForm } from '@/features/moderation/ModerationForm';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const REFUSED = 'The moderation queue needs the content moderation permission (content.moderate).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const oldestFirst = <T,>(items: readonly T[], at: (item: T) => string) => [...items].sort((a, b) => at(a).localeCompare(at(b)));

/** D12: what members sent that waits for a moderator, oldest first. */
export default function ModerationPage(props: PageProps<'/moderation'>) {
  return (
    <>
      <PageHeader ta="நடுவர் வரிசை" en="Moderation queue" />
      <Suspense fallback={null}>
        <Done searchParams={props.searchParams} />
      </Suspense>
      <p className="text-sm text-muted">
        Oldest first. Publish what is ready, or reject it with the reason its author is told. You cannot moderate your own idea or
        proposal; the API checks your areas on every decision.
      </p>
      <Suspense fallback={<ConsoleLoading rows={4} />}>
        <PendingIdeas />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={4} />}>
        <PendingProposals />
      </Suspense>
      <Section id="cases" title="Community cases" ta="சமூக விவகாரங்கள்">
        <p className="text-sm text-text">
          Public summaries and information members add to a case are moderated inside each case file, next to the case they belong to.
        </p>
        <ul className="flex flex-wrap gap-3">
          <li>
            <Link href="/cases?stage=resolved" className={`inline-flex min-h-11 items-center font-semibold text-primary underline ${FOCUS}`}>
              Resolved cases, for public summaries
            </Link>
          </li>
          <li>
            <Link href="/cases" className={`inline-flex min-h-11 items-center font-semibold text-primary underline ${FOCUS}`}>
              All cases in your areas
            </Link>
          </li>
        </ul>
      </Section>
    </>
  );
}

async function Done({ searchParams }: { searchParams: PageProps<'/moderation'>['searchParams'] }) {
  const query = await searchParams;
  return <Feedback done={one(query.done)} />;
}

async function PendingIdeas() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let ideas: PendingIdea[];
  try {
    ideas = oldestFirst(await (await staffApi()).listPendingIdeas(), (idea) => idea.createdAt);
  } catch (error) {
    return (
      <Section id="ideas" title="Ideas" ta="யோசனைகள்">
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <p className="text-sm text-muted">Ideas and surveys are not switched on yet.</p>
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The idea queue is not available." />
        )}
      </Section>
    );
  }
  const areaNames = await loadAreaNames(ideas.map((idea) => idea.areaKey));
  return (
    <Section id="ideas" title={`Ideas waiting (${ideas.length})`} ta="காத்திருக்கும் யோசனைகள்">
      {ideas.length === 0 ? (
        <p className="text-sm text-muted">No ideas are waiting.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-mono font-semibold">{idea.ideaRef}</span>
                <span>{areaText(idea.areaKey, areaNames, 'en')}</span>
                <span className="tabular-nums">sent {formatDateTime(idea.createdAt)}</span>
              </div>
              <h3 className="font-semibold text-text">{idea.title}</h3>
              <p className="whitespace-pre-wrap text-sm text-text">
                <span className="text-xs font-semibold text-muted">Who it helps: </span>
                {idea.benefit}
              </p>
              <ModerationForm kind="idea" itemId={idea.id} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

async function PendingProposals() {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let proposals: ProposalSummary[];
  try {
    proposals = oldestFirst(await (await staffApi()).listManagedProposals({ stage: ['pending_moderation'] }), (p) => p.updatedAt);
  } catch (error) {
    return (
      <Section id="proposals" title="Development proposals" ta="அபிவிருத்தி முன்மொழிவுகள்">
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <p className="text-sm text-muted">Development proposals are not switched on yet.</p>
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The proposal queue is not available." />
        )}
      </Section>
    );
  }
  const areaNames = await loadAreaNames(proposals.map((proposal) => proposal.areaKey));
  return (
    <Section id="proposals" title={`Development proposals waiting (${proposals.length})`} ta="காத்திருக்கும் அபிவிருத்தி முன்மொழிவுகள்">
      <p className="text-sm text-muted">Read the whole proposal before publishing it: the problem, the solution and any evidence.</p>
      {proposals.length === 0 ? (
        <p className="text-sm text-muted">No proposals are waiting.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-mono font-semibold">{proposal.proposalRef}</span>
                <BilingualTag label={CATEGORY_LABELS[proposal.category]} />
                <span>{areaText(proposal.areaKey, areaNames, 'en')}</span>
                <span className="tabular-nums">sent {formatDateTime(proposal.updatedAt)}</span>
              </div>
              <h3 className="font-semibold text-text">{proposal.title}</h3>
              <Link href={`/development/${proposal.id}`} className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
                Read the full proposal
              </Link>
              {proposal.mine ? (
                <p className="text-sm font-semibold text-warning">! This is your own proposal; another moderator decides it.</p>
              ) : (
                <ModerationForm kind="proposal" itemId={proposal.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
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
