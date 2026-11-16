import type { PromiseSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { PromiseKindTag, PromiseStatusTag } from './PromiseTags';

/** One promise in M18: its kind, status, responsible office and due date; opens M19. */
export function PromiseCard({ promise }: { promise: PromiseSummary }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const title = localized(promise.titleEn, promise.titleTa);
  const kind = t(`m.promises.kind_${promise.kind}`);
  const status = t(`m.promises.status_${promise.status}`);
  const office = localized(promise.officeEn, promise.officeTa);
  const due = t('m.promises.dueOn', { date: formatDate(promise.dueDate, language) });

  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/promises/[id]', params: { id: promise.id } })}
      accessibilityLabel={`${title}. ${kind}. ${status}. ${office}. ${due}. ${promise.promiseRef}`}
      accessibilityHint={t('m.promises.opensPromise')}>
      <View style={styles.tags}>
        <PromiseKindTag kind={promise.kind} />
        <PromiseStatusTag status={promise.status} />
      </View>
      <AppText step="card">{title}</AppText>
      <AppText step="secondary" tone="muted" mono>
        {promise.promiseRef}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {`${t(`m.promises.theme_${promise.theme}`)} · ${office}`}
      </AppText>
      <AppText step="caption" tone="muted">
        {due}
      </AppText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] } });
