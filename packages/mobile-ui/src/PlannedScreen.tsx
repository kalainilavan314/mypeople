import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@my-people/design-tokens';

import { textStyle } from './fonts';
import { stringsFor } from './strings';

type Props = {
  language: string;
  /** Anything that already works on this screen, shown under the notice. */
  children?: ReactNode;
};

/**
 * A tab whose feature is not built yet. It says so plainly instead of showing
 * sample data, so nobody mistakes the shell for a working feature. The screen
 * title is in the navigation header.
 */
export function PlannedScreen({ language, children }: Props) {
  const text = stringsFor(language);
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.notice}>
        <Text style={[textStyle(language, 'label'), styles.noticeTitle]}>{text.notBuilt}</Text>
        <Text style={[textStyle(language, 'secondary'), styles.noticeText]}>{text.notBuiltDetail}</Text>
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.gutter, gap: spacing[4] },
  notice: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing[4],
    gap: spacing[1],
  },
  noticeTitle: { color: colors.text },
  noticeText: { color: colors.textMuted },
});
