import type { CourseCard as Course } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, IconTile, StatusTag, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { ProgressBar } from '@/components/ProgressBar';

/** One course in H15: its lessons and minutes, and how far the member is; opens the course. */
export function CourseCard({ course }: { course: Course }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(course.titleEn, course.titleTa);
  const size = t('m.learning.size', { lessons: course.lessons, minutes: course.minutes });
  const progress = t('m.learning.progress', { done: course.completedLessons, total: course.lessons });
  const completed = course.completedAt ? t('m.learning.completedOn', { date: formatDate(course.completedAt, language) }) : null;

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/learning/[course]', params: { course: course.id } })}
      accessibilityLabel={[title, size, progress, completed].filter(Boolean).join('. ')}
      accessibilityHint={t('m.learning.opensCourse')}>
      <View style={styles.row}>
        <IconTile icon="school-outline" tint="green" size={40} />
        <View style={styles.text}>
          <AppText step="card">{title}</AppText>
          <AppText step="secondary" tone="secondary">
            {localized(course.summaryEn, course.summaryTa)}
          </AppText>
        </View>
      </View>
      <AppText step="caption" tone="muted">
        {size}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {progress}
      </AppText>
      <ProgressBar done={course.completedLessons} total={course.lessons} label={progress} />
      {completed ? <StatusTag tone="verified" label={completed} /> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  text: { flex: 1, gap: 2 },
});
