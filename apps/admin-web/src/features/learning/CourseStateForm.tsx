'use client';

import { useActionState } from 'react';

import { ActionCard, ActionProblems, ActionSubmit } from '@/components/ActionForm';
import type { FormState } from '@/lib/formState';

import { moveCourse } from './actions';
import { LEARNING_TARGETS, canPublish } from './forms';

/** Publish a draft (it needs at least one lesson) or retire a published course; neither can be undone. */
export function CourseStateForm({ courseId, state: current, lessons }: { courseId: string; state: 'draft' | 'published' | 'retired'; lessons: number }) {
  const [state, action] = useActionState<FormState, FormData>(moveCourse, null);
  if (current === 'retired') return <p className="text-sm text-muted">A retired course cannot be published again. Make a new course instead.</p>;
  const publishing = current === 'draft';
  const ready = !publishing || canPublish(lessons);
  return (
    <ActionCard
      id="course-state"
      title={publishing ? 'Publish the course' : 'Retire the course'}
      intro={
        publishing
          ? 'Members can take it once published. It cannot change after that: to change it, retire it and publish a new one.'
          : 'Members can no longer start it. A retired course cannot be published again.'
      }>
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3">
        <ActionProblems form="course-state" state={state} targets={LEARNING_TARGETS} fields={[]} linkFor={(problem) => (problem === 'lessons_required' ? '#edit-lessons' : undefined)} />
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="state" value={publishing ? 'published' : 'retired'} />
        {ready ? null : (
          <p id="course-state-needs" className="text-sm font-semibold text-warning">
            ! Add at least one lesson and save the draft before publishing.
          </p>
        )}
        <ActionSubmit tone={publishing ? 'primary' : 'danger'} disabled={!ready} describedBy={ready ? undefined : 'course-state-needs'}>
          {publishing ? 'Publish to members' : 'Retire the course'}
        </ActionSubmit>
      </form>
    </ActionCard>
  );
}
