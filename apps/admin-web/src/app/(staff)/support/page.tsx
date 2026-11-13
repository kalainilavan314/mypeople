import { ApiError, type SupportAppeal, type SupportCaseSummary, type SupportProgramme } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { SimpleForm } from '@/components/SimpleForm';
import { decideAppeal } from '@/features/support/actions';
import { appealFields } from '@/features/support/appealFields';
import { CASE_STATES, CATEGORY_LABELS, STATE_LABELS, SUPPORT_TARGETS, criteriaOptions, queueOrder } from '@/features/support/forms';
import { SupportNav } from '@/features/support/SupportNav';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Community support needs an assistance permission (intake, casework, decisions or programmes).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D13: the cases the viewer may open, emergencies first, and the appeals waiting for someone else to decide. */
export default function SupportPage(props: PageProps<'/support'>) {
  return (
    <>
      <PageHeader ta="சமூக உதவி" en="Community support">
        <ButtonLink href="/support/new">Record a request</ButtonLink>
      </PageHeader>
      <SupportNav current="/support" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Queue searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={3} />}>
        <OpenAppeals />
      </Suspense>
    </>
  );
}

async function Queue({ searchParams }: { searchParams: PageProps<'/support'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const state = CASE_STATES.find((item) => item === one(query.state));
  let cases: SupportCaseSummary[];
  try {
    cases = queueOrder(await (await staffApi()).listSupportCases(state ? [state] : []));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Community support" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The support queue is not available." />;
  }
  const areaNames = await loadAreaNames(cases.map((item) => item.areaKey));
  const created = one(query.case);

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      {created && /^[0-9a-f-]{36}$/i.test(created) ? (
        <Link href={`/support/${created}`} className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
          Open the request just recorded
        </Link>
      ) : null}
      <p className="text-sm text-muted">
        Help never depends on membership, donations or political support. You see the cases waiting for screening, the ones assigned to
        you, and, if you decide, every case in your areas. Emergencies come first.
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Filter by state">
        {[undefined, ...CASE_STATES].map((code) => (
          <li key={code ?? 'all'}>
            <Link
              href={code ? `/support?state=${code}` : '/support'}
              aria-current={state === code ? 'page' : undefined}
              className={`flex min-h-11 flex-col justify-center rounded-lg border px-3 py-1.5 text-sm ${FOCUS_RING} ${state === code ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-card text-text hover:bg-surface'}`}>
              <span lang="ta" className="font-semibold">{code ? STATE_LABELS[code].ta : 'அனைத்தும்'}</span>
              <span lang="en" className="text-xs">{code ? STATE_LABELS[code].en : 'All'}</span>
            </Link>
          </li>
        ))}
      </ul>
      <RecordTable
        caption="Community support cases"
        locale={locale}
        rows={cases}
        rowKey={(item) => item.id}
        refHeader="Case"
        href={(item) => `/support/${item.id}`}
        linkText={(item) => item.caseRef}
        empty={state ? 'No cases in this state that you may open.' : 'No cases for you yet.'}
        columns={[
          {
            header: 'Priority',
            cell: (item) => (item.emergency ? <BilingualTag label={{ ta: 'அவசரம்', en: 'Emergency' }} tone="refused" /> : <span className="text-xs text-muted">Routine</span>),
          },
          { header: 'State', cell: (item) => <BilingualTag label={STATE_LABELS[item.state] ?? { ta: item.state, en: item.state }} tone={item.state === 'closed' ? 'neutral' : 'waiting'} /> },
          { header: 'Help', cell: (item) => <BilingualText ta={CATEGORY_LABELS[item.category].ta} en={CATEGORY_LABELS[item.category].en} /> },
          { header: 'Area', cell: (item) => <span className="text-text">{areaText(item.areaKey, areaNames, 'en')}</span> },
          {
            header: 'Caseworker',
            cell: (item) => (item.caseworkerName ? <span className="text-text">{item.caseworkerName}</span> : <span className="font-semibold text-warning">Not assigned</span>),
          },
          { header: 'Received', cell: (item) => <span className="flex flex-col text-xs tabular-nums text-muted"><span>{formatDateTime(item.createdAt)}</span><span>{item.channel}</span></span> },
        ]}
      />
    </div>
  );
}

/** FR-AST-011: open appeals and complaints, for a decision-maker other than the one who decided. */
async function OpenAppeals() {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  if (!staff.permissions.has('assistance.decide')) return null;
  const locale = await getAdminLocale(staff.member.language);
  const client = await staffApi();
  let appeals: SupportAppeal[];
  let programmes: SupportProgramme[] = [];
  try {
    appeals = await client.listSupportAppeals();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return null;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The appeals are not available." />;
  }
  try {
    programmes = await client.listSupportProgrammes();
  } catch {
    programmes = [];
  }
  const fields = appealFields(criteriaOptions(programmes));
  return (
    <Section id="appeals" ta="மேன்முறையீடுகளும் முறைப்பாடுகளும்" en={`Open appeals and complaints (${appeals.length})`} intro="Decided within 15 working days by someone other than the person who made the decision.">
      {appeals.length === 0 ? (
        <p className="text-sm text-muted">No appeals are waiting.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {appeals.map((appeal) => (
            <li key={appeal.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <BilingualTag label={appeal.kind === 'appeal' ? { ta: 'மேன்முறையீடு', en: 'Appeal' } : { ta: 'முறைப்பாடு', en: 'Complaint' }} tone="waiting" />
                <span className="text-xs tabular-nums text-muted">sent {formatDateTime(appeal.createdAt)} · due {formatDateTime(appeal.dueAt)}</span>
              </p>
              <p className="whitespace-pre-wrap text-text">{appeal.body}</p>
              <SimpleForm id={`appeal-${appeal.id.slice(0, 8)}`} action={decideAppeal} hidden={{ appealId: appeal.id }} fields={fields} submits={[{ label: 'Record decision' }]} targets={SUPPORT_TARGETS} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
