import { ApiError, type ManagedCourseSummary } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { RecordTable } from '@/components/RecordTable';
import { COURSE_STATE_LABELS, TOPIC_LABELS } from '@/features/learning/forms';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const REFUSED = 'Learning courses need the content moderation permission (content.moderate).';
const TONES = { draft: 'neutral', published: 'done', retired: 'refused' } as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** H15, H16 on the staff side: every course, drafts to finish, published ones members can take. */
export default function LearningPage(props: PageProps<'/learning'>) {
  return (
    <>
      <PageHeader ta="கற்றல் பாடநெறிகள்" en="Learning courses">
        <Link href="/learning/new" className={`inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS}`}>
          New course
        </Link>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <CourseList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CourseList({ searchParams }: { searchParams: PageProps<'/learning'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;

  let courses: ManagedCourseSummary[];
  try {
    courses = await (await staffApi()).listManagedCourses();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Learning is not switched on yet.</p>;
    }
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The course list is not available." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">Courses reach every member once published. A published course is retired and replaced, never changed.</p>
      <RecordTable
        caption="Learning courses"
        locale={locale}
        rows={courses}
        rowKey={(course) => course.id}
        refHeader="Reference"
        href={(course) => `/learning/${course.id}`}
        linkText={(course) => course.courseRef}
        empty="No courses yet."
        columns={[
          { header: 'State', cell: (course) => <BilingualTag label={COURSE_STATE_LABELS[course.state]} tone={TONES[course.state]} /> },
          { header: 'Title', cell: (course) => <BilingualText ta={course.titleTa} en={course.titleEn} className="max-w-xs" /> },
          { header: 'Topic', cell: (course) => <BilingualText ta={TOPIC_LABELS[course.topic].ta} en={TOPIC_LABELS[course.topic].en} /> },
          {
            header: 'Lessons',
            cell: (course) => (
              <span className="text-xs tabular-nums text-text">
                {course.lessons} {course.lessons === 1 ? 'lesson' : 'lessons'} · {course.minutes} min
              </span>
            ),
          },
          { header: 'Published', cell: (course) => <span className="text-xs tabular-nums text-muted">{formatDate(course.publishedAt)}</span> },
        ]}
      />
    </div>
  );
}
