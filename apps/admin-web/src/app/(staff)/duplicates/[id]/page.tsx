import type { DuplicateCaseFile } from '@my-people/api-client';
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
    value: 'not_duplicate',
    ta: 'இரட்டைக் கணக்கு அல்ல: இரு வேறு தனிநபர்கள்',
    en: 'Not a duplicate: two different people',
  },
  {
    value: 'duplicate_confirmed',
    ta: 'இரட்டைக் கணக்கு உறுதிப்படுத்தப்பட்டது: ஒரே நபர், இரண்டு கணக்குகள்',
    en: 'Duplicate confirmed: one person, two accounts',
  },
] as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Both accounts side by side with their history, decided with a recorded justification. */
export default function DuplicateCasePage(props: PageProps<'/duplicates/[id]'>) {
  return (
    <Suspense fallback={<p className="text-muted">… Loading the case</p>}>
      <DuplicateCase params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DuplicateCase({ params, searchParams }: Pick<PageProps<'/duplicates/[id]'>, 'params' | 'searchParams'>) {
  const { id } = await params;
  const query = await searchParams;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let file: DuplicateCaseFile;
  try {
    file = await (await staffApi()).getDuplicateCase(id);
  } catch (error) {
    if (isRefusal(error)) return <p className="text-error">! {getLocalizedMessage(error.code, locale)}</p>;
    throw error;
  }
  const claimedByMe = file.claimedBy === staff.member.id;
  const open = file.state === 'open' || file.state === 'in_review';

  return (
    <>
      <PageHeader ta="இரட்டைக் கணக்கு" en={`Case ${file.caseRef}`}>
        <Link href="/duplicates" className="text-sm text-primary underline">
          <span lang={locale}>{locale === 'ta' ? '← விசாரணைகளுக்குத் திரும்புக' : '← Back to investigations'}</span>
        </Link>
      </PageHeader>
      <Feedback error={query.error} problems={query.problems} done={query.done} />
      <p className="text-sm">
        <StateTag state={file.state} /> · {words(file.signal)} · {locale === 'ta' ? 'தொடங்கப்பட்டது' : 'opened'} {formatDateTime(file.openedAt)}
        {file.openedReason ? ` · ${file.openedReason}` : ''}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {file.members.map((member) => (
          <section key={member.memberId} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4 text-sm">
            <h2 className="font-bold text-text">{member.details.fullName}</h2>
            <p className="font-mono text-muted">{member.details.memberCode}</p>
            <p className="flex flex-wrap items-baseline gap-1">
              <span lang={locale} className="font-semibold text-text">{locale === 'ta' ? 'பிறந்த திகதி:' : 'Date of birth:'}</span>
              <span className="text-muted">({member.details.dob ?? '—'})</span>
            </p>
            <p className="flex flex-wrap items-baseline gap-1">
              <span lang={locale} className="font-semibold text-text">{locale === 'ta' ? 'அடையாளம்:' : 'Identity:'}</span>
              <span>{words(member.verificationStatus)}</span>
              <span className="text-muted">·</span>
              <span lang={locale} className="font-semibold text-text">{locale === 'ta' ? 'உறுப்புரிமை:' : 'Membership:'}</span>
              <span>{words(member.membershipState)}</span>
            </p>
            <ul className="divide-y divide-line">
              {member.documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {words(document.kind)} · version {document.version}
                  </span>
                  {claimedByMe ? (
                    <a href={`/evidence/${document.id}`} target="_blank" rel="noopener noreferrer" className="min-h-11 rounded-lg border border-line px-3 py-2 font-semibold text-primary">
                      <span lang={locale}>{locale === 'ta' ? 'படத்தைத் திறக்க' : 'Open image'}</span>
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <CaseControls
        kind="duplicates"
        id={file.id}
        open={open}
        claimedByMe={claimedByMe}
        outcomes={OUTCOMES}
        error={one(query.error)}
        problems={query.problems}
      />
    </>
  );
}
