import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens';

import type { Loaded } from '@/hooks/useApi';
import { errorMessage } from '@/lib/errors';

import { Button } from './Button';
import { Notice } from './Notice';

type Props<T> = {
  query: Loaded<T>;
  children: (data: T) => ReactNode;
};

/**
 * Loading, error with retry, or the content (QueryBoundary in the spec). Data
 * already shown stays while it reloads; an error never invents content.
 */
export function QueryView<T>({ query, children }: Props<T>) {
  const { t } = useTranslation();
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.loading) {
    return (
      <View style={styles.loading} accessibilityLabel={t('m.common.loading')} accessibilityRole="progressbar">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={styles.error}>
      <Notice tone="error" title={t('m.common.loadFailed')}>
        {errorMessage(t, query.error)}
      </Notice>
      <Button label={t('m.common.retry')} variant="secondary" icon="refresh" onPress={query.reload} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing[8], alignItems: 'center' },
  error: { gap: spacing[3] },
});
