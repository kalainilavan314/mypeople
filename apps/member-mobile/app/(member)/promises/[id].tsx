import type { PromiseDetail } from '@my-people/api-client';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  formatDate,
  Screen,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useLocalized,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { useAreaName } from '@/features/area/useAreaName';
import { PromiseFeedback } from '@/features/promises/PromiseFeedback';
import { PromiseKindTag, PromiseStatusTag } from '@/features/promises/PromiseTags';
import { PromiseUpdates } from '@/features/promises/PromiseUpdates';
import { api } from '@/lib/api';

/**
 * M19 Promise detail: where the promise came from, who answers for it, its measurable target and
 * milestones, every dated update with its evidence, and moderated feedback with the office's
 * replies. "Last verified" says when someone last checked it (FR-PRM-006).
 */
export default function PromiseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const promise = useApiQuery(() => api().getPromise(id), [id]);
  useReloadOnFocus(promise.reload);
  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={promise.reload}
      refreshing={promise.loading && promise.data !== undefined}>
      <FeatureQueryView feature="promises" query={promise}>
        {(data) => <PromiseBody promise={data} />}
      </FeatureQueryView>
    </Screen>
  );
}

function PromiseBody({ promise }: { promise: PromiseDetail }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const areaName = useAreaName(promise.areaKey);
  const blockers = promise.blockersEn ? localized(promise.blockersEn, promise.blockersTa ?? '') : null;

  return (
    <>
      <View style={styles.header}>
        <PromiseKindTag kind={promise.kind} />
        <AppText step="page" accessibilityRole="header">
          {localized(promise.titleEn, promise.titleTa)}
        </AppText>
        <AppText step="secondary" tone="muted" mono>
          {promise.promiseRef}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t(`m.promises.theme_${promise.theme}`)}
        </AppText>
        <AppText step="body" tone="secondary">
          {localized(promise.descriptionEn, promise.descriptionTa)}
        </AppText>
      </View>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.promises.status')}
        </AppText>
        <PromiseStatusTag status={promise.status} />
        {promise.statusReason ? <DetailRow label={t('m.promises.statusReason')} value={promise.statusReason} /> : null}
        {blockers ? <DetailRow label={t('m.promises.blockers')} value={blockers} /> : null}
        <DetailRow
          label={t('m.promises.lastVerified')}
          value={promise.lastVerifiedAt ? formatDate(promise.lastVerifiedAt, language) : t('m.promises.notVerifiedYet')}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.promises.details')}
        </AppText>
        <DetailRow label={t('m.promises.target')} value={localized(promise.targetEn, promise.targetTa)} />
        <DetailRow label={t('m.promises.office')} value={localized(promise.officeEn, promise.officeTa)} />
        {areaName ? <DetailRow label={t('m.promises.area')} value={areaName} /> : null}
        <DetailRow label={t('m.promises.plannedStart')} value={formatDate(promise.plannedStart, language)} />
        <DetailRow label={t('m.promises.due')} value={formatDate(promise.dueDate, language)} />
        <DetailRow label={t('m.promises.source')} value={promise.sourceReference} />
        <DetailRow label={t('m.promises.sourceDate')} value={formatDate(promise.sourcePublishedOn, language)} />
      </SurfaceCard>

      {promise.milestones.length > 0 ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('m.promises.milestones')}
          </AppText>
          {promise.milestones.map((milestone, index) => (
            <View key={`${milestone.titleEn}-${index}`} style={[styles.milestone, index > 0 && styles.divider]}>
              <AppText step="body">{localized(milestone.titleEn, milestone.titleTa)}</AppText>
              {milestone.dueDate ? (
                <AppText step="caption" tone="muted">
                  {t('m.promises.dueOn', { date: formatDate(milestone.dueDate, language) })}
                </AppText>
              ) : null}
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      <PromiseUpdates updates={promise.updates} />
      <PromiseFeedback promiseId={promise.id} feedback={promise.feedback} />
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[2] },
  card: { gap: spacing[3] },
  milestone: { gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[2] },
});
