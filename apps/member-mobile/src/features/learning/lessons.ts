import type { CourseDetail, CourseLesson } from '@my-people/api-client';

/** The lessons in course order. */
export function orderedLessons(course: CourseDetail): CourseLesson[] {
  return [...course.lessonList].sort((a, b) => a.position - b.position);
}

/**
 * Where Start or Resume opens: the lesson saved with "Save and exit", else the first lesson not
 * completed, else the first lesson.
 */
export function resumeLesson(course: CourseDetail): CourseLesson | undefined {
  const lessons = orderedLessons(course);
  const saved = course.completedAt ? undefined : lessons.find((lesson) => lesson.position === course.resumePosition);
  return saved ?? lessons.find((lesson) => !lesson.completed) ?? lessons[0];
}
