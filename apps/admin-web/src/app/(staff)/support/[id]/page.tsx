import { ApiError, type ApiClient, type SupportCaseFile, type SupportCaseworker, type SupportPartner, type SupportProgramme } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import {
  addNote,
  assignCaseworker,
  closeCase,
  decideAppeal,
  decideCase,
  linkDuplicate,
  recordDelivery,
  referCase,
  updateReferral,
} from '@/features/support/actions';
import { appealFields } from '@/features/support/appealFields';
import {
  CATEGORY_LABELS,
  OUTCOMES,
  OUTCOME_LABELS,
  REFERRAL_STATE_LABELS,
  STATE_LABELS,
  SUPPORT_TARGETS,
  criteriaOptions,
  partnerMayAnswer,
} from '@/features/support/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This support case does not exist.';
const REFUSED = 'Community support needs an assistance permission.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The lists a form offers; a list the API refuses is shown empty, and the form says so. */
async function quietly<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch {
    return [];
  }
}

/**
 * D13: one support case. Its file opens only for its assigned caseworker and the decision-makers of
 * its area (FR-AST-007, S12); intake staff see only the summary of a case waiting for screening, to
 * route it to a caseworker. Every other look is refused, and every look is logged. Membership,
 * verification and political data are never part of it.
 */
export default function SupportCasePage(props: PageProps<'/support/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <CaseView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CaseView({ params, searchParams }: Pick<PageProps<'/support/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/support">Back to community support</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  const client: ApiClient = await staffApi();
  let file: SupportCaseFile;
  try {
    file = await client.getSupportCase(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403 && error.code === 'not_assigned') {
      return (
        <>
          {backLink}
          <PageProblem
            locale={locale}
            message="This case opens only for its assigned caseworker and the decision-makers of its area."
            detail="Access to support cases is limited to protect the people asking for help, and this attempt has been recorded in the audit log."
          />
        </>
      );
    }
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="Community support" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }

  const [caseworkers, programmes, partners] = await Promise.all([
    file.mayAssign ? quietly<SupportCaseworker>(() => client.listSupportCaseworkers(id)) : Promise.resolve([] as SupportCaseworker[]),
    file.mayDecide ? quietly<SupportProgramme>(() => client.listSupportProgrammes()) : Promise.resolve([] as SupportProgramme[]),
    file.mayWork ? quietly<SupportPartner>(() => client.listSupportPartners()) : Promise.resolve([] as SupportPartner[]),
  ]);
  const areaNames = await loadAreaNames([file.areaKey]);
  const criteria = criteriaOptions(programmes, file.category);
  const open = file.state !== 'closed' && file.state !== 'withdrawn';
  const decidable = file.state === 'screening' || file.state === 'assessment';
  const hidden = { caseId: file.id };

  const header = (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{file.caseRef}</span>
          <BilingualTag label={STATE_LABELS[file.state] ?? { ta: file.state, en: file.state }} tone={open ? 'waiting' : 'neutral'} />
          {file.emergency ? <BilingualTag label={{ ta: 'அவசரம்', en: 'Emergency' }} tone="refused" /> : null}
          <BilingualTag label={CATEGORY_LABELS[file.category]} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">{file.applicantName ?? 'Case summary'}</h1>
        <p className="text-sm text-muted">
          {areaText(file.areaKey, areaNames, 'en')} · received {formatDateTime(file.createdAt)} by {file.channel} ·{' '}
          {file.caseworkerName ? `caseworker ${file.caseworkerName}` : 'no caseworker yet'}
        </p>
        <p className="text-xs text-muted">Opening this case is recorded in the audit log.</p>
      </header>

      <Feedback done={one(query.done)} />
    </>
  );

  // S12: intake staff routing a case waiting for screening get only its summary from the API.
  if (!file.fullFile) {
    return (
      <>
        {header}
        <div className="flex max-w-2xl flex-col gap-4">
          <p role="note" className="rounded-lg border border-line bg-surface p-3 text-sm text-text">
            You see the summary only. The person&apos;s name, phone, household and request, and the case record, open only for
            the assigned caseworker and the decision-makers of the area. Route the case to a caseworker of the area; after that it
            leaves your queue.
          </p>
          {file.mayAssign && open ? <AssignForm caseId={file.id} caseworkers={caseworkers} /> : null}
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="request" ta="கோரிக்கை" en="The request">
            <p className="whitespace-pre-wrap text-sm text-text">{file.summary}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <Detail label="Phone">{file.applicantPhone ?? 'Not given'}</Detail>
              <Detail label="Household">{file.household ?? 'Not given'}</Detail>
              <Detail label="Linked case">{file.linkedCaseRef ?? 'None'}</Detail>
            </dl>
          </Section>

          {file.possibleDuplicates.length > 0 ? (
            <Section id="duplicates" ta="ஒத்த கோரிக்கைகள்" en="Possible duplicates" intro="A possible duplicate is linked to this case, never a reason to refuse help (FR-AST-006).">
              <ul className="flex flex-col gap-3">
                {file.possibleDuplicates.map((other) => (
                  <li key={other.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm">
                    <span className="flex flex-col">
                      <span className="font-mono font-semibold text-text">{other.caseRef}</span>
                      <span className="text-xs text-muted">
                        {CATEGORY_LABELS[other.category].en} · {STATE_LABELS[other.state]?.en ?? other.state} · {formatDateTime(other.createdAt)}
                      </span>
                    </span>
                    <SimpleForm id={`link-${other.id.slice(0, 8)}`} action={linkDuplicate} hidden={{ ...hidden, otherCaseId: other.id }} fields={[]} submits={[{ label: 'Link', tone: 'secondary' }]} targets={SUPPORT_TARGETS} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section id="decisions" ta="முடிவுகள்" en={`Decisions (${file.decisions.length})`} intro="Each decision cites the published criteria version and gives its reasons in both languages.">
            {file.decisions.length === 0 ? (
              <p className="text-sm text-muted">No decision yet.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {file.decisions.map((decision) => (
                  <li key={decision.id} className="flex flex-col gap-2 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <BilingualTag label={OUTCOME_LABELS[decision.outcome]} tone={decision.outcome === 'not_eligible' ? 'refused' : 'done'} />
                      <span className="text-xs text-muted">
                        {decision.programmeNameEn} · criteria v{decision.criteriaVersion} · {formatDateTime(decision.decidedAt)}
                        {decision.replacesId ? ' · replaces an earlier decision after an appeal' : ''}
                      </span>
                    </p>
                    <Both ta={decision.reasonTa} en={decision.reasonEn} />
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section id="deliveries" ta="வழங்கல்கள்" en={`Deliveries (${file.deliveries.length})`}>
            {file.deliveries.length === 0 ? (
              <p className="text-sm text-muted">Nothing delivered yet. Deliveries are recorded after a decision.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {file.deliveries.map((delivery, index) => (
                  <li key={`${delivery.deliveredOn}-${index}`} className="py-2">
                    <span className="font-semibold text-text">
                      {delivery.kind} · {delivery.amount}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatDate(delivery.deliveredOn)} by {delivery.provider} · evidence: {delivery.evidence}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="referrals" ta="பரிந்துரைகள்" en={`Referrals (${file.referrals.length})`}>
            {file.referrals.length === 0 ? (
              <p className="text-sm text-muted">No referrals.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {file.referrals.map((referral) => (
                  <li key={referral.id} className="flex flex-col gap-2 py-3">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text">{referral.partner}</span>
                      <BilingualTag
                        label={REFERRAL_STATE_LABELS[referral.state] ?? { ta: referral.state, en: referral.state }}
                        tone={referral.state === 'proposed' ? 'waiting' : referral.state === 'consent_declined' || referral.state === 'declined' ? 'neutral' : 'done'}
                      />
                    </p>
                    {referral.purpose ? <p className="whitespace-pre-wrap text-sm text-text">Purpose: {referral.purpose}</p> : null}
                    <span className="text-xs text-muted">
                      proposed {formatDateTime(referral.createdAt)} ·{' '}
                      {referral.consentAt
                        ? `consent ${referral.consentRecordedBy === 'applicant' ? 'given by the applicant in the app' : 'recorded by the caseworker'} ${formatDateTime(referral.consentAt)}`
                        : referral.state === 'proposed'
                          ? 'nothing is shared until the applicant consents in the app'
                          : 'nothing was shared'}
                      {referral.outcome ? ` · outcome: ${referral.outcome}` : ''}
                    </span>
                    {file.mayWork && open && partnerMayAnswer(referral.state) ? (
                      <SimpleForm
                        id={`referral-${referral.id.slice(0, 8)}`}
                        action={updateReferral}
                        hidden={{ ...hidden, referralId: referral.id }}
                        fields={[
                          {
                            name: 'state',
                            label: 'What the partner said',
                            kind: 'select',
                            required: true,
                            options: [
                              { value: '', label: 'Choose' },
                              { value: 'accepted', label: 'Accepted' },
                              { value: 'completed', label: 'Completed' },
                              { value: 'declined', label: 'Declined' },
                            ],
                          },
                          { name: 'outcome', label: 'Outcome (optional)', maxLength: 500 },
                        ]}
                        submits={[{ label: 'Update referral', tone: 'secondary' }]}
                        targets={SUPPORT_TARGETS}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="appeals" ta="மேன்முறையீடுகள்" en={`Appeals and complaints (${file.appeals.length})`} intro="Decided by someone other than the person who made the decision.">
            {file.appeals.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {file.appeals.map((appeal) => (
                  <li key={appeal.id} className="flex flex-col gap-2 py-3 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <BilingualTag
                        label={appeal.state === 'open' ? { ta: 'திறந்துள்ளது', en: 'Open' } : appeal.state === 'upheld' ? { ta: 'முடிவு உறுதிசெய்யப்பட்டது', en: 'Upheld' } : { ta: 'முடிவு மாற்றப்பட்டது', en: 'Changed' }}
                        tone={appeal.state === 'open' ? 'waiting' : 'done'}
                      />
                      <span className="text-xs text-muted">
                        {appeal.kind} · sent {formatDateTime(appeal.createdAt)} · due {formatDateTime(appeal.dueAt)}
                      </span>
                    </p>
                    <p className="whitespace-pre-wrap text-text">{appeal.body}</p>
                    {appeal.reason ? <p className="text-xs text-muted">Decision: {appeal.reason}</p> : null}
                    {appeal.state === 'open' && file.mayDecide ? (
                      <SimpleForm id={`appeal-${appeal.id.slice(0, 8)}`} action={decideAppeal} hidden={{ ...hidden, appealId: appeal.id }} fields={appealFields(criteria)} submits={[{ label: 'Record decision' }]} targets={SUPPORT_TARGETS} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="notes" ta="குறிப்புகள்" en={`Case notes (${file.notes.length})`}>
            {file.notes.length === 0 ? (
              <p className="text-sm text-muted">No notes yet.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line text-sm">
                {file.notes.map((note, index) => (
                  <li key={`${note.createdAt}-${index}`} className="py-2">
                    <p className="whitespace-pre-wrap text-text">{note.body}</p>
                    <p className="text-xs text-muted">
                      {note.author} · {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            {open && (file.mayWork || file.mayDecide) ? (
              <SimpleForm id="note" action={addNote} hidden={hidden} fields={[{ name: 'body', label: 'Add a note', kind: 'textarea', required: true, minLength: 3, maxLength: 3000 }]} submits={[{ label: 'Add note', tone: 'secondary' }]} targets={SUPPORT_TARGETS} />
            ) : null}
          </Section>
        </div>

        <aside aria-label="Case actions" className="flex flex-col gap-4">
          {file.mayAssign && open ? <AssignForm caseId={file.id} caseworkers={caseworkers} /> : null}
          {file.mayDecide && decidable ? (
            <SimpleForm
              id="decision"
              title="Decision"
              intro={criteria.length ? 'Against the current published criteria of a programme. The applicant is told.' : 'No programme has published criteria yet; publish them under Programmes first.'}
              action={decideCase}
              hidden={hidden}
              fields={[
                { name: 'outcome', label: 'Outcome', kind: 'select', required: true, wide: true, options: [{ value: '', label: 'Choose the outcome' }, ...OUTCOMES.map((outcome) => ({ value: outcome, label: `${OUTCOME_LABELS[outcome].ta} · ${OUTCOME_LABELS[outcome].en}` }))] },
                { name: 'criteriaVersionId', label: 'Programme criteria', kind: 'select', required: true, wide: true, options: [{ value: '', label: 'Choose the criteria' }, ...criteria] },
                { name: 'reasonTa', label: 'Reasons in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 10, maxLength: 3000 },
                { name: 'reasonEn', label: 'Reasons in English', kind: 'textarea', lang: 'en', required: true, minLength: 10, maxLength: 2000 },
              ]}
              submits={[{ label: 'Record decision' }]}
              targets={SUPPORT_TARGETS}
            />
          ) : null}
          {file.mayWork && file.state === 'decided' ? (
            <SimpleForm
              id="delivery"
              title="Record a delivery"
              intro="What was given, how much, when, by whom, and the evidence. The applicant is told."
              action={recordDelivery}
              hidden={hidden}
              fields={[
                { name: 'kind', label: 'What was given', required: true, minLength: 3, maxLength: 120, wide: true },
                { name: 'amount', label: 'Quantity or value', required: true, maxLength: 120 },
                { name: 'deliveredOn', label: 'Date', kind: 'date', required: true },
                { name: 'provider', label: 'Given by', required: true, minLength: 2, maxLength: 200, wide: true },
                { name: 'evidence', label: 'Evidence (receipt or record number)', required: true, minLength: 3, maxLength: 500, wide: true },
              ]}
              submits={[{ label: 'Record delivery' }]}
              targets={SUPPORT_TARGETS}
            />
          ) : null}
          {file.mayWork && open ? (
            <SimpleForm
              id="refer"
              title="Refer to a partner"
              intro={
                file.consentInApp
                  ? 'The applicant has an app account: they see the partner and the purpose, and the referral is sent only if they consent there.'
                  : 'Only with the applicant’s consent for this partner to see the case. Ask them first, then record it.'
              }
              action={referCase}
              hidden={{ ...hidden, consentInApp: file.consentInApp ? '1' : '0' }}
              fields={[
                { name: 'partnerId', label: 'Partner', kind: 'select', required: true, wide: true, options: [{ value: '', label: partners.length ? 'Choose the partner' : 'No partners yet' }, ...partners.filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.name} (${p.kind})` }))] },
                { name: 'purpose', label: 'Purpose, shown to the applicant', kind: 'textarea', required: true, minLength: 3, maxLength: 500, wide: true },
                ...(file.consentInApp
                  ? []
                  : [{ name: 'consent', label: 'The applicant agreed that this partner may see the case.', kind: 'checkbox' as const, required: true, wide: true }]),
              ]}
              submits={[{ label: file.consentInApp ? 'Propose to the applicant' : 'Refer', tone: 'secondary' }]}
              targets={SUPPORT_TARGETS}
            />
          ) : null}
          {file.mayWork && open ? (
            <SimpleForm
              id="close"
              title="Close the case"
              action={closeCase}
              hidden={hidden}
              fields={[{ name: 'note', label: 'Closing note', kind: 'textarea', required: true, minLength: 5, maxLength: 1000 }]}
              submits={[{ label: 'Close case', tone: 'danger' }]}
              targets={SUPPORT_TARGETS}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}

function AssignForm({ caseId, caseworkers }: { caseId: string; caseworkers: readonly SupportCaseworker[] }) {
  return (
    <SimpleForm
      id="assign"
      title="Assign a caseworker"
      intro={caseworkers.length ? 'Only the assigned caseworker and the decision-makers can open the case.' : 'No one in this area holds casework yet.'}
      action={assignCaseworker}
      hidden={{ caseId }}
      fields={[
        {
          name: 'caseworkerId',
          label: 'Caseworker',
          kind: 'select',
          required: true,
          wide: true,
          options: [{ value: '', label: 'Choose a caseworker' }, ...caseworkers.map((worker) => ({ value: worker.memberId, label: worker.fullName }))],
        },
      ]}
      submits={[{ label: 'Assign' }]}
      targets={SUPPORT_TARGETS}
    />
  );
}
