import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import type { Loaded } from '../hooks/useApi';
import { useLanguage } from '../hooks/useLanguage';
import { stringsFor } from '../strings';

import { Button } from './Button';
import { Notice } from './Notice';

type Props<T> = {
  query: Loaded<T>;
  children: (data: T) => ReactNode;
  /** The app's words for a failed request (each app has its own error texts). */
  describeError: (error: unknown) => string;
};

/**
 * Loading, error with retry, or the content (QueryBoundary in the spec). Data
 * already shown stays while it reloads; an error never invents content.
 */
export function QueryView<T>({ query, children, describeError }: Props<T>) {
  const text = stringsFor(useLanguage());
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.loading) {
    return (
      <View style={styles.loading} accessibilityLabel={text.loading} accessibilityRole="progressbar">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={styles.error}>
      <Notice tone="error" title={text.loadFailed}>
        {describeError(query.error)}
      </Notice>
      <Button label={text.tryAgain} variant="secondary" icon="refresh" onPress={query.reload} />
    </View>
  );
}

/** Keep app-specific API error wording at each app boundary without duplicating loading UI. */
export function createQueryView(describeError: (t: ReturnType<typeof useTranslation>['t'], error: unknown) => string) {
  return function AppQueryView<T>({ query, children }: Omit<Props<T>, 'describeError'>) {
    const { t } = useTranslation();
    return <QueryView query={query} describeError={(error) => describeError(t, error)}>{children}</QueryView>;
  };
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing[8], alignItems: 'center' },
  error: { gap: spacing[3] },
});
