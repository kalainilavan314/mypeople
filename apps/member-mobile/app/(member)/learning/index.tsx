import type { CourseCard as Course } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Screen, SegmentedControl, useApiQuery, useReloadOnFocus } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { CourseCard } from '@/features/learning/CourseCard';
import { api } from '@/lib/api';

type Shelf = 'available' | 'mine' | 'completed';

/** H15 Learning: Available, My courses and Completed, each card with lessons, minutes and progress. */
export default function LearningScreen() {
  const { t } = useTranslation();
  const [shelf, setShelf] = useState<Shelf>('available');
  const catalogue = useApiQuery(() => api().getCourseCatalogue());
  useReloadOnFocus(catalogue.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={catalogue.reload}
      refreshing={catalogue.loading && catalogue.data !== undefined}>
      <FeatureQueryView feature="learning" query={catalogue}>
        {(data) => {
          const courses: Course[] = data[shelf];
          return (
            <>
              <AppText step="body" tone="secondary">
                {t('m.learning.intro')}
              </AppText>
              <SegmentedControl
                label={t('m.learning.show')}
                selected={shelf}
                onSelect={setShelf}
                options={[
                  { key: 'available', label: t('m.learning.available') },
                  { key: 'mine', label: t('m.learning.mine') },
                  { key: 'completed', label: t('m.learning.completed') },
                ]}
              />
              {courses.length === 0 ? (
                <AppText step="secondary" tone="muted">
                  {t(`m.learning.empty_${shelf}`)}
                </AppText>
              ) : (
                <View style={styles.list}>
                  {courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </View>
              )}
              <AppText step="caption" tone="muted">
                {t('m.learning.noRoleChange')}
              </AppText>
            </>
          );
        }}
      </FeatureQueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[3] } });
