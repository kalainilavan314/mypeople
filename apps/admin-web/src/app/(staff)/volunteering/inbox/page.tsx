import { ApiError, type VolunteerInboxItem } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { AnswerForm } from '@/features/volunteering/AnswerForm';
import { INBOX_KIND_LABELS } from '@/features/volunteering/forms';
import { VolunteeringNav } from '@/features/volunteering/VolunteeringNav';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'The volunteer inbox needs the volunteer management permission (volunteers.manage).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FR-VOL-007, 008: open messages and change requests from volunteers in the coordinator's areas, oldest first. */
export default function VolunteerInboxPage(props: PageProps<'/volunteering/inbox'>) {
  return (
    <>
      <PageHeader ta="தன்னார்வலர் செய்திகள்" en="Volunteer inbox" />
      <VolunteeringNav current="/volunteering/inbox" />
      <Suspense fallback={<ConsoleLoading rows={5} />}>
        <Inbox searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Inbox({ searchParams }: { searchParams: PageProps<'/volunteering/inbox'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;

  let items: VolunteerInboxItem[];
  try {
    items = await (await staffApi()).listVolunteerInbox();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Volunteering is not switched on yet.</p>;
    }
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The volunteer inbox is not available." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Messages and change requests waiting for an answer, oldest first. Answering tells the volunteer in the app; nothing here shows
        their phone number.
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">No messages are waiting for an answer.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <article aria-labelledby={`contact-${item.id}`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <BilingualTag label={INBOX_KIND_LABELS[item.kind] ?? { ta: item.kind, en: item.kind }} tone={item.kind === 'change_request' ? 'waiting' : 'neutral'} />
                  <h2 id={`contact-${item.id}`} className="font-semibold text-text">
                    {item.volunteerName}
                  </h2>
                  <span className="font-mono text-xs text-muted">{item.offerRef}</span>
                </div>
                <p className="text-sm text-muted">
                  About{' '}
                  <Link href={`/volunteering/${item.opportunityId}`} className="font-semibold text-primary underline">
                    {item.opportunityTitleEn}
                  </Link>{' '}
                  · sent {formatDateTime(item.createdAt)}
                </p>
                <p className="whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm text-text">{item.body}</p>
                <AnswerForm contactId={item.id} changeRequest={item.kind === 'change_request'} />
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
