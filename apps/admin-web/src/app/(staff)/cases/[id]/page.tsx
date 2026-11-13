import { ApiError, type ApiClient, type CaseAction, type CaseEvidence, type CaseFile, type CaseOwnerOption } from '@my-people/api-client';
import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { StateTag } from '@/components/StateTag';
import { AdditionModeration } from '@/features/cases/AdditionModeration';
import { CaseHistory, EntryDetails } from '@/features/cases/CaseHistory';
import { CaseStageTag, OverdueTag } from '@/features/cases/CaseStageTag';
import { ChallengeForm } from '@/features/cases/ChallengeForm';
import { DistrictDecisionForm } from '@/features/cases/DistrictDecisionForm';
import { AddFindingForm, DsReportForm } from '@/features/cases/DsActions';
import { ExecutiveDecisionForm } from '@/features/cases/ExecutiveDecisionForm';
import { AddFactForm, ForwardForm, LinkForm, ReturnForm } from '@/features/cases/GnActions';
import { NOTE_IN_DETAILS, REPORT_KINDS, historyTitle, noteLabel } from '@/features/cases/history';
import { ClosingReportForm, ProgressForm } from '@/features/cases/ImplementationActions';
import { AssignForm, NoteForm, TakeCaseForm } from '@/features/cases/OwnershipActions';
import { PublicSummaryForm } from '@/features/cases/PublicSummaryForm';
import { RegionalPlanForm } from '@/features/cases/RegionalPlanForm';
import { ReporterContact } from '@/features/cases/ReporterContact';
import {
  FINDING_KINDS,
  FINDING_LABELS,
  OPEN_STAGES,
  STAGE_PERMISSION,
  colomboToday,
  isFindingKind,
  ownerPermissionsFor,
  type FindingKindCode,
} from '@/features/cases/stages';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate, formatDateTime, words } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const NOT_FOUND = 'This case does not exist or is outside your areas.';
const REFUSED = 'Community cases need a case permission (collect, research, decide, plan, approve or implement) or content moderation.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The case file (W03 to W08): the report, the research, the decisions, the actions allowed now, the history. */
export default function CaseFilePage(props: PageProps<'/cases/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <CaseFileView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

type Owners = Readonly<Record<string, readonly CaseOwnerOption[]>>;

/** The people each form may name; a list the API refuses is shown as empty, and the form says so. */
async function loadOwners(client: ApiClient, caseId: string, permissions: readonly string[]): Promise<Owners> {
  const lists = await Promise.all(
    permissions.map(async (permission) => {
      try {
        return [permission, (await client.listCaseOwnerOptions(caseId, permission)).items] as const;
      } catch {
        return [permission, []] as const;
      }
    }),
  );
  return Object.fromEntries(lists);
}

async function CaseFileView({ params, searchParams }: Pick<PageProps<'/cases/[id]'>, 'params' | 'searchParams'>) {
  // Read when the request comes in: API_URL may be set only on the running server, and the
  // earliest due date a form offers is today.
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
    <Link href="/cases" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      ← Back to community cases
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
  let file: CaseFile;
  try {
    file = await client.getCase(id);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return (
        <>
          {backLink}
          <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Community cases are not switched on yet.</p>
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

  const allowed = new Set(file.allowedActions);
  const owners = await loadOwners(client, file.id, ownerPermissionsFor(file.stage, file.allowedActions));
  const ownersFor = (permission: string | undefined) => (permission ? owners[permission] ?? [] : []);
  const areaKeys = [
    file.districtCode ? `district:${file.districtCode}` : null,
    file.dsCode ? `ds:${file.dsCode}` : null,
    file.gnCode ? `gn:${file.gnCode}` : null,
  ].filter((key): key is string => key !== null);
  const areaNames = await loadAreaNames(areaKeys);
  const minDate = colomboToday(new Date());
  const open = OPEN_STAGES.has(file.stage);
  const facts = file.history.filter((entry) => entry.kind === 'fact');
  const findings = file.history.filter((entry) => entry.kind === 'finding');
  const reports = file.history.filter((entry) => REPORT_KINDS.has(entry.kind)).reverse();
  // W08: the implementation works to the scope the district or the executive approved, the latest one.
  const approval = file.history.findLast((entry) => entry.kind === 'district_action' || entry.kind === 'executive_approved');
  const approvedScope = typeof approval?.details.scope === 'string' ? approval.details.scope : null;
  const stageOwners = ownersFor(STAGE_PERMISSION[file.stage]);
  const canTake = allowed.has('assign') && !file.ownerId && stageOwners.some((owner) => owner.memberId === staff.member.id);
  // Forms remount after every recorded action, so a finished form starts empty again.
  const version = `${file.updatedAt}-${file.history.length}`;
  const reportAnchor = (entry: CaseAction) =>
    REPORT_KINDS.has(entry.kind) ? `entry-${entry.id}` : entry.kind === 'fact' ? 'facts' : entry.kind === 'finding' ? 'findings' : null;

  return (
    <>
      {backLink}

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{file.caseNumber}</span>
          <CaseStageTag stage={file.stage} />
          {file.overdue ? <OverdueTag /> : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">{file.title}</h1>
        <p className="text-sm text-muted">
          {words(file.category)} · reported {formatDateTime(file.createdAt)}
        </p>
      </header>

      <Feedback error={one(query.error)} problems={one(query.problems)} done={one(query.done)} />

      {file.openChallenge ? (
        <section aria-labelledby="open-challenge-heading" className="rounded-xl border border-warning bg-warning-bg p-4 text-sm text-warning">
          <h2 id="open-challenge-heading" className="font-bold">
            ! The reporter challenged the closure on {formatDateTime(file.openChallenge.createdAt)}
          </h2>
          {file.openChallenge.note ? <p className="mt-1 whitespace-pre-wrap">{file.openChallenge.note}</p> : null}
        </section>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="report" title="The reporter’s description">
            <p className="whitespace-pre-wrap text-sm leading-6 text-text">{file.description}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Location">
                {file.locationKind === 'my_gn' ? 'The reporter’s own GN division' : file.locationKind === 'landmark' ? 'Near a landmark' : 'Described in words'}
                {file.locationText ? <span className="block whitespace-pre-wrap">{file.locationText}</span> : null}
              </Detail>
              <Detail label="Visibility">{file.visibility === 'public' ? 'Public case' : 'Case team only'}</Detail>
              <Detail label="Affected area">
                {file.affectedArea ? (
                  <span className="whitespace-pre-wrap">{file.affectedArea}</span>
                ) : (
                  <span className="text-muted">Recorded by the GN collector when the case is forwarded</span>
                )}
              </Detail>
            </dl>
          </Section>

          {approvedScope && (file.stage === 'implementation' || file.stage === 'resolved') ? (
            <Section id="scope" title="Approved scope" intro="The work the implementation owner does, as approved. Progress and the closing report are checked against it.">
              <p className="whitespace-pre-wrap text-sm leading-6 text-text">{approvedScope}</p>
              {approval ? (
                <p className="text-xs text-muted">
                  {historyTitle(approval)} · {approval.actorName ?? 'unknown'} · {formatDateTime(approval.createdAt)}
                </p>
              ) : null}
            </Section>
          ) : null}

          <Section id="evidence" title="Evidence photos" intro="Every photo opened here is recorded in the audit log.">
            {file.evidence.length === 0 ? <p className="text-sm text-muted">No photos yet.</p> : <PhotoGrid caseId={file.id} photos={file.evidence} />}
          </Section>

          <Section id="facts" title="Observed facts" intro="Recorded at GN collection, each with its source.">
            {facts.length === 0 ? (
              <p className="text-sm text-muted">No facts recorded yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {facts.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-2 text-sm">
                    <p className="whitespace-pre-wrap text-text">{String(entry.details.statement ?? '')}</p>
                    <p className="text-xs text-muted">
                      Source: {String(entry.details.source ?? '—')} · {entry.actorName ?? 'Unknown'} · {formatDateTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {findings.length > 0 || file.stage === 'ds' ? (
            <Section id="findings" title="Divisional findings" intro="Verified facts are kept apart from assumptions.">
              <Findings entries={findings} />
            </Section>
          ) : null}

          {reports.length > 0 ? (
            <Section id="reports" title="Reports and decisions" intro="Newest first. Every version is kept.">
              <ol className="flex flex-col gap-4">
                {reports.map((entry) => (
                  <li key={entry.id}>
                    <article id={`entry-${entry.id}`} tabIndex={-1} className="flex flex-col gap-2 rounded-lg border border-line p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-semibold text-text">{historyTitle(entry)}</h3>
                        <time dateTime={entry.createdAt} className="text-xs tabular-nums text-muted">
                          {formatDateTime(entry.createdAt)}
                        </time>
                      </div>
                      <p className="text-xs text-muted">By {entry.actorName ?? 'unknown'}</p>
                      {entry.note && !NOTE_IN_DETAILS.has(entry.kind) ? (
                        <div className="text-sm">
                          <p className="text-xs text-muted">{noteLabel(entry.kind)}</p>
                          <p className="whitespace-pre-wrap text-text">{entry.note}</p>
                        </div>
                      ) : null}
                      <EntryDetails entry={entry} />
                      {file.evidence.some((photo) => photo.actionId === entry.id) ? (
                        <PhotoGrid caseId={file.id} photos={file.evidence.filter((photo) => photo.actionId === entry.id)} />
                      ) : null}
                    </article>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {file.closingSummaryEn || file.closingSummaryTa ? (
            <Section
              id="closing"
              title="Member summary of the closing report"
              intro="Only the reporter reads this. Followers and the area see the public summary a moderator publishes.">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted">Tamil</p>
                  <p lang="ta" className="whitespace-pre-wrap text-text">
                    {file.closingSummaryTa}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">English</p>
                  <p lang="en" className="whitespace-pre-wrap text-text">
                    {file.closingSummaryEn}
                  </p>
                </div>
              </div>
            </Section>
          ) : null}

          <Section id="additions" title="Added information" intro="Information the reporter or other members added after the report.">
            {file.additions.length === 0 ? (
              <p className="text-sm text-muted">Nothing added yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {file.additions.map((addition) => (
                  <li key={addition.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <StateTag state={addition.state} locale={locale} />
                      <span>{addition.fromReporter ? 'From the reporter' : 'From a member'}</span>
                      {addition.isReply ? <span>· answer to the request for details</span> : null}
                      <span>· {formatDateTime(addition.createdAt)}</span>
                      {addition.photos > 0 ? <span>· {addition.photos === 1 ? '1 photo' : `${addition.photos} photos`} (under Evidence photos)</span> : null}
                    </div>
                    <p className="whitespace-pre-wrap text-text">{addition.body}</p>
                    {addition.publishedBody ? (
                      <div className="rounded-lg bg-surface p-2">
                        <p className="text-xs font-semibold text-muted">Published to members as this edited version</p>
                        <p className="whitespace-pre-wrap text-text">{addition.publishedBody}</p>
                      </div>
                    ) : null}
                    {addition.moderationReason ? <p className="text-xs text-muted">Moderation reason: {addition.moderationReason}</p> : null}
                    {allowed.has('moderate_additions') && addition.state === 'pending' ? (
                      addition.mine ? (
                        <p className="text-sm font-semibold text-warning">! You added this; another moderator decides it.</p>
                      ) : (
                        <AdditionModeration key={version} caseId={file.id} additionId={addition.id} />
                      )
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="actions" title="Your actions at this stage">
            {file.stage === 'returned' ? (
              <p className="text-sm text-muted">Waiting for the reporter to add the details asked for. This wait has no time limit.</p>
            ) : null}
            <div key={version} className="flex flex-col gap-4">
              {canTake ? <TakeCaseForm caseId={file.id} /> : null}
              {allowed.has('fact') ? <AddFactForm caseId={file.id} /> : null}
              {allowed.has('forward') ? <ForwardForm caseId={file.id} owners={ownersFor('cases.research')} factCount={facts.length} /> : null}
              {allowed.has('return') ? <ReturnForm caseId={file.id} /> : null}
              {allowed.has('link') ? <LinkForm caseId={file.id} /> : null}
              {allowed.has('finding') ? <AddFindingForm caseId={file.id} /> : null}
              {allowed.has('ds_report') ? <DsReportForm caseId={file.id} owners={ownersFor('cases.decide_district')} /> : null}
              {allowed.has('district_decision') ? (
                <DistrictDecisionForm
                  caseId={file.id}
                  owners={{ implementers: ownersFor('cases.implement_and_close'), regional: ownersFor('cases.plan_regional') }}
                  minDate={minDate}
                />
              ) : null}
              {allowed.has('regional_plan') ? <RegionalPlanForm caseId={file.id} /> : null}
              {allowed.has('executive_decision') ? (
                <ExecutiveDecisionForm caseId={file.id} implementers={ownersFor('cases.implement_and_close')} minDate={minDate} />
              ) : null}
              {allowed.has('progress') ? <ProgressForm caseId={file.id} /> : null}
              {allowed.has('close') ? <ClosingReportForm caseId={file.id} /> : null}
              {allowed.has('decide_challenge') && file.openChallenge ? (
                <ChallengeForm
                  caseId={file.id}
                  owners={{
                    gn: ownersFor('cases.collect'),
                    ds: ownersFor('cases.research'),
                    district: ownersFor('cases.decide_district'),
                    implementation: ownersFor('cases.implement_and_close'),
                  }}
                  minDate={minDate}
                />
              ) : null}
              {allowed.has('assign') ? <AssignForm caseId={file.id} owners={stageOwners} currentOwnerId={file.ownerId} /> : null}
              {allowed.has('note') ? <NoteForm caseId={file.id} /> : null}
              {allowed.has('publish_summary') ? (
                <PublicSummaryForm
                  caseId={file.id}
                  afterClosure={file.stage === 'resolved'}
                  current={{
                    titleTa: file.publicTitleTa ?? '',
                    titleEn: file.publicTitleEn ?? '',
                    summaryTa: file.publicSummaryTa ?? '',
                    summaryEn: file.publicSummaryEn ?? '',
                  }}
                />
              ) : null}
              {NO_FORMS.every((action) => !allowed.has(action)) ? (
                <p className="text-sm text-muted">
                  {open
                    ? 'You can read this case. The next step belongs to the stage’s owner.'
                    : 'This case is closed. Its history stays on record.'}
                </p>
              ) : null}
            </div>
          </Section>

          <Section id="history" title="Case history" intro="Every step and handover, oldest first.">
            <CaseHistory history={file.history} reportAnchor={reportAnchor} />
          </Section>
        </div>

        <aside aria-labelledby="summary-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5 lg:sticky lg:top-6">
          <h2 id="summary-heading" className="text-base font-bold text-text">
            Case summary
          </h2>
          <dl className="grid gap-4 text-sm">
            <Detail label="Case ID">
              <span className="font-mono">{file.caseNumber}</span>
            </Detail>
            <Detail label="Stage">
              <CaseStageTag stage={file.stage} />
              <span className="mt-1 block text-xs text-muted">since {formatDateTime(file.stageEnteredAt)}</span>
            </Detail>
            <Detail label="Owner">
              {file.ownerName ?? (open ? <span className="font-semibold text-warning">Unassigned</span> : '—')}
            </Detail>
            <Detail label="Area">
              {areaKeys.length === 0 ? '—' : areaKeys.map((key) => <span key={key} className="block">{areaText(key, areaNames, 'en')}</span>)}
            </Detail>
            {open ? (
              <Detail label="Stage due">
                <span className="tabular-nums">{file.stageDueAt ? formatDateTime(file.stageDueAt) : 'No time limit'}</span>
                {file.overdue ? (
                  <span className="mt-1 block">
                    <OverdueTag />
                  </span>
                ) : null}
              </Detail>
            ) : null}
            {file.implementationDueAt ? (
              <Detail label="Implementation due">
                <span className="tabular-nums">{formatDate(file.implementationDueAt)}</span>
              </Detail>
            ) : null}
            <Detail label="Visibility">{file.visibility === 'public' ? 'Public' : 'Case team only'}</Detail>
            <Detail label="Public summary">{publicStateText(file.publicState)}</Detail>
            {file.parentCaseNumber ? (
              <Detail label="Linked to">
                <Link href={`/cases?q=${encodeURIComponent(file.parentCaseNumber)}`} className="font-mono font-semibold text-primary underline">
                  {file.parentCaseNumber}
                </Link>
              </Detail>
            ) : null}
            {file.linkedReports.length > 0 ? (
              <Detail label="Linked reports">
                <ul className="flex flex-col gap-1">
                  {file.linkedReports.map((report) => (
                    <li key={report.id}>
                      <Link href={`/cases/${report.id}`} className="font-mono font-semibold text-primary underline">
                        {report.caseNumber}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Detail>
            ) : null}
            {file.closedAt ? (
              <Detail label="Closed">
                {formatDateTime(file.closedAt)}
                {file.closedLevel ? <span className="block text-xs text-muted">decided at {file.closedLevel} level</span> : null}
              </Detail>
            ) : null}
            <Detail label="Last updated">{formatDateTime(file.updatedAt)}</Detail>
          </dl>
          {allowed.has('view_reporter_contact') ? (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-text">Reporter contact</h3>
              <ReporterContact caseId={file.id} />
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

/** The actions that have a form here; view_reporter_contact and moderate_additions are shown elsewhere. */
const NO_FORMS = [
  'fact', 'forward', 'return', 'link', 'finding', 'ds_report', 'district_decision', 'regional_plan', 'executive_decision',
  'progress', 'close', 'decide_challenge', 'assign', 'note', 'publish_summary',
] as const;

function publicStateText(state: string): string {
  switch (state) {
    case 'published':
      return 'Published';
    case 'pending':
      return 'Waiting for a moderator';
    case 'withheld':
      return 'Withheld';
    default:
      return 'None';
  }
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
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

function PhotoGrid({ caseId, photos }: { caseId: string; photos: readonly CaseEvidence[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((photo, index) => {
        const source = photo.purpose === 'report' ? 'Sent with the report' : photo.purpose === 'case' ? 'Staff evidence' : photo.fromReporter ? 'From the reporter' : 'From a member';
        return (
          <li key={photo.id}>
            <a
              href={`/evidence/case/${caseId}/${photo.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-col gap-1 rounded-lg text-xs text-muted hover:text-text ${FOCUS}`}>
              <Image
                src={`/evidence/case/${caseId}/${photo.id}`}
                alt={`${source}, photo ${index + 1}`}
                width={160}
                height={160}
                unoptimized
                className="aspect-square w-full rounded border border-line bg-surface object-cover"
              />
              <span>{source}</span>
              <span className="tabular-nums">{formatDateTime(photo.createdAt)}</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Findings({ entries }: { entries: readonly CaseAction[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted">No findings recorded yet.</p>;
  const byKind = new Map<FindingKindCode, CaseAction[]>();
  for (const entry of entries) {
    const kind = isFindingKind(entry.details.kind) ? entry.details.kind : 'open_question';
    byKind.set(kind, [...(byKind.get(kind) ?? []), entry]);
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {FINDING_KINDS.filter((kind) => byKind.has(kind) || kind === 'verified_fact' || kind === 'assumption').map((kind) => (
        <div
          key={kind}
          className={`flex flex-col gap-2 rounded-lg border p-3 ${
            kind === 'verified_fact' ? 'border-success' : kind === 'assumption' ? 'border-warning' : 'border-line'
          }`}>
          <h3 className="text-sm font-bold text-text">
            <span lang="ta" className="block text-xs font-semibold text-muted">
              {FINDING_LABELS[kind].ta}
            </span>
            {FINDING_LABELS[kind].en}
          </h3>
          {(byKind.get(kind) ?? []).length === 0 ? (
            <p className="text-xs text-muted">None recorded.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {(byKind.get(kind) ?? []).map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 py-2 text-sm">
                  <p className="whitespace-pre-wrap text-text">{String(entry.details.statement ?? '')}</p>
                  <p className="text-xs text-muted">
                    {entry.details.source ? `Source: ${String(entry.details.source)} · ` : ''}
                    {entry.actorName ?? 'Unknown'} · {formatDateTime(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
