'use server';

import { redirect } from 'next/navigation';

import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

import { COURSE_TEXT_FIELDS, LEARNING_REFUSED, readCourse } from './forms';

// Learning courses (H15, H16 on the staff side). The API checks content.moderate and that only a
// draft changes on every call; a published course is retired and replaced rather than changed.

const FIELDS = [...COURSE_TEXT_FIELDS, 'topic', 'lessonsJson'];

function refused(error: unknown, values: Record<string, string>): FormState {
  const { code, problems } = failure(error);
  return { error: code, problems, values, attempt: Date.now() };
}

export async function createCourse(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, FIELDS);
  const { input, problems } = readCourse(formData);
  if (!input) return incomplete(LEARNING_REFUSED, problems, values);
  let id: string;
  try {
    id = (await (await staffApi()).createCourse(input)).id;
  } catch (error) {
    return refused(error, values);
  }
  redirect(`/learning/${id}?done=course_created`);
}

export async function updateCourse(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'courseId');
  if (!id) redirect('/learning');
  const values = valuesOf(formData, FIELDS);
  const { input, problems } = readCourse(formData);
  if (!input) return incomplete(LEARNING_REFUSED, problems, values);
  try {
    await (await staffApi()).updateCourse(id, input);
  } catch (error) {
    return refused(error, values);
  }
  redirect(`/learning/${id}?done=course_saved`);
}

/** Publish a draft (it needs at least one lesson) or retire a published course. */
export async function moveCourse(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'courseId');
  if (!id) redirect('/learning');
  const state = text(formData, 'state');
  if (state !== 'published' && state !== 'retired') return incomplete(LEARNING_REFUSED, ['decision_required'], {});
  try {
    await (await staffApi()).moveCourse(id, state);
  } catch (error) {
    return refused(error, {});
  }
  redirect(`/learning/${id}?done=course_${state}`);
}
