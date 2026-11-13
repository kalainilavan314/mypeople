import { ApiError, type ManagedCourse } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { CourseForm } from '@/features/learning/CourseForm';
import { CourseStateForm } from '@/features/learning/CourseStateForm';
import { COURSE_STATE_LABELS, TOPIC_LABELS } from '@/features/learning/forms';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const NOT_FOUND = 'This course does not exist.';
const REFUSED = 'Learning courses need the content moderation permission (content.moderate).';
const TONES = { draft: 'neutral', published: 'done', retired: 'refused' } as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** One course: its lessons, publish or retire, and for a draft the form that replaces it. */
export default function CoursePage(props: PageProps<'/learning/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <CourseView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CourseView({ params, searchParams }: Pick<PageProps<'/learning/[id]'>, 'params' | 'searchParams'>) {
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
    <Link href="/learning" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      ← Back to learning courses
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

  let course: ManagedCourse;
  try {
    course = await (await staffApi()).getManagedCourse(id);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return (
        <>
          {backLink}
          <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Learning is not switched on yet.</p>
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

  const minutes = course.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  const current: Record<string, string> = {
    titleTa: course.titleTa,
    titleEn: course.titleEn,
    summaryTa: course.summaryTa,
    summaryEn: course.summaryEn,
    topic: course.topic,
    lessonsJson: JSON.stringify(course.lessons),
  };

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">{course.courseRef}</span>
          <BilingualTag label={COURSE_STATE_LABELS[course.state]} tone={TONES[course.state]} />
          <BilingualTag label={TOPIC_LABELS[course.topic]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{course.titleTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {course.titleEn}
          </span>
        </h1>
        <p className="text-sm text-muted">
          {course.lessons.length} {course.lessons.length === 1 ? 'lesson' : 'lessons'} · {minutes} minutes
          {course.publishedAt ? ` · published ${formatDateTime(course.publishedAt)}` : ''}
        </p>
      </header>

      <Feedback done={one(query.done)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {course.state === 'draft' ? (
            <Section id="edit" title="Change the draft" intro="Saving replaces the whole draft: its text, topic and lessons.">
              <CourseForm courseId={course.id} current={current} />
            </Section>
          ) : (
            <Section id="lessons" title="What members read" intro="A published or retired course cannot change.">
              <div className="flex flex-col gap-1 text-sm">
                <p lang="ta" className="whitespace-pre-wrap text-text">
                  {course.summaryTa}
                </p>
                <p lang="en" className="whitespace-pre-wrap text-muted">
                  {course.summaryEn}
                </p>
              </div>
              <ol className="flex flex-col divide-y divide-line">
                {course.lessons.map((lesson, index) => (
                  <li key={`${index}-${lesson.titleEn}`} className="flex flex-col gap-2 py-4">
                    <h3 className="flex flex-col font-semibold text-text">
                      <span className="text-xs text-muted">
                        Lesson {index + 1} · {lesson.minutes} min
                      </span>
                      <span lang="ta">{lesson.titleTa}</span>
                      <span lang="en" className="text-sm font-medium text-muted">
                        {lesson.titleEn}
                      </span>
                    </h3>
                    <details className="text-sm">
                      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Read the lesson text</summary>
                      <p lang="ta" className="whitespace-pre-wrap text-text">
                        {lesson.bodyTa}
                      </p>
                      <p lang="en" className="mt-3 whitespace-pre-wrap text-muted">
                        {lesson.bodyEn}
                      </p>
                    </details>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>

        <aside aria-label="State" className="flex flex-col gap-4">
          <CourseStateForm courseId={course.id} state={course.state} lessons={course.lessons.length} />
        </aside>
      </div>
    </>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={`${id}-section`} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
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
