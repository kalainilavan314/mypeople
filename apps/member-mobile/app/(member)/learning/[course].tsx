import Ionicons from '@expo/vector-icons/Ionicons';
import type { CourseDetail } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  Notice,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ProgressBar } from '@/components/ProgressBar';
import { orderedLessons, resumeLesson } from '@/features/learning/lessons';
import { api } from '@/lib/api';

function openLesson(course: string, lesson: string) {
  router.push({ pathname: '/learning/[course]/[lesson]', params: { course, lesson } });
}

/** A course: its lessons with what is done, and Start or Resume at the saved lesson (FR-LRN-003). */
export default function CourseScreen() {
  const { course: id } = useLocalSearchParams<{ course: string }>();
  const course = useApiQuery(() => api().getCourse(id), [id]);
  useReloadOnFocus(course.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={course.reload} refreshing={course.loading && course.data !== undefined}>
      <FeatureQueryView feature="learning" query={course}>
        {(data) => <CourseBody course={data} />}
      </FeatureQueryView>
    </Screen>
  );
}

function CourseBody({ course }: { course: CourseDetail }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const lessons = orderedLessons(course);
  const resume = resumeLesson(course);
  const started = course.completedLessons > 0 || course.resumePosition !== null;
  const progress = t('m.learning.progress', { done: course.completedLessons, total: course.lessons });

  return (
    <>
      <View style={styles.header}>
        <AppText step="page" accessibilityRole="header">
          {localized(course.titleEn, course.titleTa)}
        </AppText>
        <AppText step="body" tone="secondary">
          {localized(course.summaryEn, course.summaryTa)}
        </AppText>
        <AppText step="caption" tone="muted">
          {t('m.learning.size', { lessons: course.lessons, minutes: course.minutes })}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {progress}
        </AppText>
        <ProgressBar done={course.completedLessons} total={course.lessons} label={progress} />
      </View>

      {course.completedAt ? (
        <Notice tone="success">{t('m.learning.courseDone', { date: formatDate(course.completedAt, language) })}</Notice>
      ) : null}
      {course.state === 'retired' ? <Notice tone="info">{t('m.learning.retired')}</Notice> : null}

      {resume && !course.completedAt ? (
        <Button
          label={started ? t('m.learning.resume') : t('m.learning.start')}
          icon="play-outline"
          onPress={() => openLesson(course.id, resume.id)}
        />
      ) : null}

      <SurfaceCard style={styles.list}>
        <AppText step="section" accessibilityRole="header" style={styles.listHeading}>
          {t('m.learning.lessons')}
        </AppText>
        {lessons.map((lesson, index) => {
          const title = localized(lesson.titleEn, lesson.titleTa);
          const number = t('m.learning.lessonOf', { number: index + 1, total: lessons.length });
          const state = lesson.completed ? t('m.learning.lessonDone') : t('m.learning.lessonNotDone');
          return (
            <Pressable
              key={lesson.id}
              onPress={() => openLesson(course.id, lesson.id)}
              accessibilityRole="link"
              accessibilityLabel={`${number}. ${title}. ${t('m.learning.minutes', { minutes: lesson.minutes })}. ${state}`}
              style={({ pressed }) => [styles.lesson, styles.divider, pressed && styles.pressed]}>
              <Ionicons
                accessible={false}
                name={lesson.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={lesson.completed ? colors.successText : colors.controlBorder}
              />
              <View style={styles.flex}>
                <AppText step="caption" tone="muted">
                  {number}
                </AppText>
                <AppText step="card">{title}</AppText>
                <AppText step="caption" tone="muted">
                  {`${t('m.learning.minutes', { minutes: lesson.minutes })} · ${state}`}
                </AppText>
              </View>
              <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.controlBorder} />
            </Pressable>
          );
        })}
      </SurfaceCard>

      <AppText step="caption" tone="muted">
        {t('m.learning.noRoleChange')}
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  list: { padding: 0, gap: 0, overflow: 'hidden' },
  listHeading: { padding: spacing[4], paddingBottom: spacing[2] },
  lesson: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  pressed: { backgroundColor: colors.surfaceVariant },
  flex: { flex: 1, gap: 2 },
});
