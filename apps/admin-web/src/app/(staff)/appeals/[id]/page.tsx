import type { AppealFile } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { CaseControls, type OutcomeOption } from '@/features/verification/CaseControls';
import { formatDateTime, words } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

const OUTCOMES: readonly OutcomeOption[] = [
  {
    value: 'uphold',
    ta: 'உறுதிப்படுத்துக: ஆரம்ப முடிவு மாற்றமின்றி நிலைநிறுத்தப்படும்',
    en: 'Uphold: the decision stands',
  },
  {
    value: 'overturn',
    ta: 'ரத்துசெய்க: மற்றொரு மதிப்பீட்டாளரின் மறுஆய்வுக்கு மீண்டும் அனுப்பப்படும்',
    en: 'Overturn: the review opens again for another reviewer',
  },
] as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The statement, the decision under appeal and the evidence, decided by an independent reviewer. */
export default function AppealPage(props: PageProps<'/appeals/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading the appeal</p>}>
      <Appeal params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Appeal({ params, searchParams }: Pick<PageProps<'/appeals/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params;
  const query = await searchParams;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let appeal: AppealFile;
  try {
    appeal = await (await staffApi()).getIdentityAppeal(id);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  const claimedByMe = appeal.claimedBy === staff.member.id;
  const open = appeal.state === 'submitted' || appeal.state === 'in_review';

  return (
    <>
      <PageHeader ta="மேன்முறையீடு" en={`Appeal ${appeal.appealRef}`}>
        <Link href="/appeals" className="text-sm text-primary underline">
          <span lang={locale}>{locale === 'ta' ? '← மேன்முறையீடுகளுக்குத் திரும்புக' : '← Back to appeals'}</span>
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />
      <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4 text-sm">
        <p>
          <StateTag state={appeal.state} /> · {locale === 'ta' ? 'சரிபார்ப்பு' : 'review'} <span className="font-mono">{appeal.reviewRef}</span> ·{' '}
          {locale === 'ta' ? 'சமர்ப்பிக்கப்பட்டது' : 'submitted'} {formatDateTime(appeal.submittedAt)}
        </p>
        <p className="font-semibold text-text">{appeal.member.fullName}</p>
        <p className="font-mono text-muted">{appeal.member.memberCode}</p>

        <h2 className="mt-2 text-base font-bold text-text">
          <span lang={locale}>{locale === 'ta' ? 'உறுப்பினரின் அறிக்கை' : 'The member’s statement'}</span>
        </h2>
        <p className="whitespace-pre-wrap">{appeal.statement}</p>

        <h2 className="mt-2 text-base font-bold text-text">
          <span lang={locale}>{locale === 'ta' ? 'மேன்முறையீட்டிலுள்ள முடிவு' : 'The decision under appeal'}</span>
        </h2>
        <p>
          {words(appeal.decision.decision)} · Tier {appeal.decision.reviewerTier} · {formatDateTime(appeal.decision.decidedAt)}
        </p>
        {appeal.decision.reasonCategory ? <p>{locale === 'ta' ? 'காரணம்:' : 'Reason:'} {words(appeal.decision.reasonCategory)}</p> : null}
        {appeal.decision.note ? <p className="text-muted">{appeal.decision.note}</p> : null}
        {appeal.outcomeReason ? (
          <p className="mt-2">
            {locale === 'ta' ? 'இறுதி முடிவு:' : 'Outcome:'} {words(appeal.state)} · {appeal.outcomeReason}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="evidence-heading" className="flex flex-col gap-2">
        <h2 id="evidence-heading" className="text-base font-bold text-text">
          <span lang={locale}>{locale === 'ta' ? 'அடையாள ஆவணச் சான்றுகள்' : 'Identity evidence images'}</span>
        </h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {appeal.documents.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-semibold text-text">
                {words(document.kind)} · version {document.version}
              </span>
              {claimedByMe ? (
                <a href={`/evidence/${document.id}`} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-lg border border-line px-3 py-2 font-semibold text-primary">
                  <span lang={locale}>{locale === 'ta' ? 'படத்தைத் திறக்க' : 'Open image'}</span>
                </a>
              ) : (
                <span className="text-xs text-muted">
                  <span lang={locale}>{locale === 'ta' ? 'திறப்பதற்குப் பொறுப்பேற்கவும்' : 'Claim to open'}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <CaseControls
        kind="appeals"
        id={appeal.id}
        open={open}
        claimedByMe={claimedByMe}
        outcomes={OUTCOMES}
        error={one(query.error)}
        problems={query.problems}
      />
    </>
  );
}
