import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';
import { CourseForm } from '@/features/learning/CourseForm';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** A new course starts as a draft; the API checks content.moderate when it is saved. */
export default function NewCoursePage() {
  return (
    <>
      <Link href="/learning" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
        ← Back to learning courses
      </Link>
      <PageHeader ta="புதிய பாடநெறி" en="New course" />
      <div className="rounded-xl border border-line bg-card p-4 sm:p-6">
        <CourseForm />
      </div>
    </>
  );
}
