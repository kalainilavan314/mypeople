import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from './AppText';

type Props = {
  /** The page's one heading; tab screens leave it to the tab header. */
  title?: string;
  subtitle?: string;
  /** A trailing control beside the title, e.g. the notifications bell. */
  action?: ReactNode;
  children: ReactNode;
  /** Pull to refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Tab screens already sit under a header that handles the top inset. */
  edges?: Edge[];
};

/** One vertical scroll container with the 20 px gutter and safe-area insets; the title is the large page title. */
export function Screen({ title, subtitle, action, children, onRefresh, refreshing = false, edges = ['top'] }: Props) {
  return (
    <SafeAreaView style={styles.page} edges={edges}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        {title ? (
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <AppText step="page" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText step="secondary" tone="muted">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {action}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.gutter, paddingBottom: spacing[10], gap: spacing[4] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[2] },
  titleText: { flex: 1, gap: spacing[1] },
});
