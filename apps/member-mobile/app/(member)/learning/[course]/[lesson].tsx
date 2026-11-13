import type { CourseDetail } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLocalized,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ProgressBar } from '@/components/ProgressBar';
import { orderedLessons } from '@/features/learning/lessons';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

function backToCourse(course: string) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/learning/[course]', params: { course } });
}

/**
 * H16 Lesson. Opening or leaving a lesson records nothing (FR-LRN-002): only "Complete lesson"
 * records progress, and "Save and exit" keeps this lesson as the place to resume, without marking
 * it done (FR-LRN-003).
 */
export default function LessonScreen() {
  const { course: courseId, lesson: lessonId } = useLocalSearchParams<{ course: string; lesson: string }>();
  const course = useApiQuery(() => api().getCourse(courseId), [courseId]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="learning" query={course}>
        {(data) => <LessonBody key={lessonId} course={data} lessonId={lessonId} />}
      </FeatureQueryView>
    </Screen>
  );
}

function LessonBody({ course: loaded, lessonId }: { course: CourseDetail; lessonId: string }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  // The course as the server last returned it: completing a lesson answers with the new progress.
  const [course, setCourse] = useState(loaded);
  const [justCompleted, setJustCompleted] = useState(false);
  const complete = useApiAction(async () => {
    setCourse(await api().completeLesson(course.id, lessonId));
    setJustCompleted(true);
  });
  const saveExit = useApiAction(async () => {
    await api().saveAndExitCourse(course.id, lessonId);
    backToCourse(course.id);
  });

  const lessons = orderedLessons(course);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  const lesson = lessons[index];
  if (!lesson) return <Notice tone="warning">{t('m.learning.lessonMissing')}</Notice>;
  const next = lessons[index + 1];
  const position = t('m.learning.lessonOf', { number: index + 1, total: lessons.length });
  const error = complete.error ?? saveExit.error;

  return (
    <>
      <AppText step="secondary" tone="muted">
        {position}
      </AppText>
      <ProgressBar done={index + 1} total={lessons.length} label={position} />
      <View style={styles.header}>
        <AppText step="page" accessibilityRole="header">
          {localized(lesson.titleEn, lesson.titleTa)}
        </AppText>
        <AppText step="caption" tone="muted">
          {t('m.learning.minutes', { minutes: lesson.minutes })}
        </AppText>
        {lesson.completed ? <StatusTag tone="verified" label={t('m.learning.lessonDone')} /> : null}
      </View>
      <SurfaceCard>
        <AppText step="body">{localized(lesson.bodyEn, lesson.bodyTa)}</AppText>
      </SurfaceCard>

      {justCompleted && course.completedAt ? (
        <Notice tone="success" title={t('m.learning.courseCompleteTitle')}>
          {t('m.learning.courseCompleteBody')}
        </Notice>
      ) : null}
      {justCompleted && !course.completedAt ? <Notice tone="success">{t('m.learning.lessonCompleted')}</Notice> : null}
      {error ? <Notice tone="error">{errorMessage(t, error)}</Notice> : null}

      {lesson.completed ? null : (
        <Button
          label={t('m.learning.completeLesson')}
          icon="checkmark-circle-outline"
          busy={complete.busy}
          disabled={saveExit.busy}
          onPress={() => void complete.run()}
        />
      )}
      {lesson.completed && next ? (
        <Button
          label={t('m.learning.nextLesson')}
          icon="arrow-forward"
          iconAfter
          onPress={() => router.replace({ pathname: '/learning/[course]/[lesson]', params: { course: course.id, lesson: next.id } })}
        />
      ) : null}
      {lesson.completed && !next ? (
        <Button label={t('m.learning.backToCourse')} icon="list-outline" onPress={() => backToCourse(course.id)} />
      ) : null}
      <Button
        label={t('m.learning.saveAndExit')}
        variant="secondary"
        icon="bookmark-outline"
        busy={saveExit.busy}
        disabled={complete.busy}
        onPress={() => void saveExit.run()}
      />
    </>
  );
}

const styles = StyleSheet.create({ header: { gap: spacing[2] } });
