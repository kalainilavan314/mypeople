import { ApiError, type TownHall } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, NotSwitchedOn } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { LANGUAGE_LABELS, STATE_LABELS, STATE_TONES } from '@/features/townhalls/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Town halls need town hall production or question moderation.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D18: town hall sessions in the viewer's areas. */
export default function TownHallsPage(props: PageProps<'/town-halls'>) {
  return (
    <>
      <PageHeader ta="மக்கள் மன்றங்கள்" en="Town halls">
        <ButtonLink href="/town-halls/new">New session</ButtonLink>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Sessions searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Sessions({ searchParams }: { searchParams: PageProps<'/town-halls'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  let sessions: TownHall[];
  try {
    sessions = await (await staffApi()).listManagedTownHalls();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Town halls" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The session list is not available." />;
  }
  const areaNames = await loadAreaNames(sessions.map((session) => session.areaKey));
  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">Members ask questions before and during a session; a moderator approves each before others see it.</p>
      <RecordTable
        caption="Town hall sessions"
        locale={locale}
        rows={sessions}
        rowKey={(session) => session.id}
        refHeader="Session"
        href={(session) => `/town-halls/${session.id}`}
        linkText={(session) => session.sessionRef}
        empty="No town hall sessions in your areas yet."
        columns={[
          { header: 'State', cell: (session) => <BilingualTag label={STATE_LABELS[session.state]} tone={STATE_TONES[session.state]} /> },
          { header: 'Title', cell: (session) => <BilingualText ta={session.titleTa} en={session.titleEn} className="max-w-xs" /> },
          { header: 'Language', cell: (session) => <span className="text-text">{LANGUAGE_LABELS[session.language].en}</span> },
          { header: 'Area', cell: (session) => <span className="text-text">{areaText(session.areaKey, areaNames, 'en')}</span> },
          { header: 'When', cell: (session) => <span className="flex flex-col text-xs tabular-nums text-muted"><span>{formatDateTime(session.startsAt)}</span><span>to {formatDateTime(session.endsAt)}</span></span> },
        ]}
      />
    </div>
  );
}
