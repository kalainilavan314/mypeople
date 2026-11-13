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
  /** Keeps phone-first flows readable when the Expo app is opened in a wide browser. */
  maxContentWidth?: number;
  /** Art drawn behind the whole page, under the status bar; it stays still while the content scrolls. */
  background?: ReactNode;
};

/** One vertical scroll container with the 20 px gutter and safe-area insets; the title is the large page title. */
export function Screen({
  title,
  subtitle,
  action,
  children,
  onRefresh,
  refreshing = false,
  edges = ['top'],
  maxContentWidth,
  background,
}: Props) {
  return (
    <SafeAreaView style={styles.page} edges={edges}>
      {background ? <View style={styles.background}>{background}</View> : null}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          maxContentWidth ? { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' } : null,
        ]}
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
  // Absolute, so it also covers the safe-area padding under the status bar; never takes touches.
  background: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' },
  content: { padding: spacing.gutter, paddingBottom: spacing[10], gap: spacing[4] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[2] },
  titleText: { flex: 1, gap: spacing[1] },
});
