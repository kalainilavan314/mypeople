import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@my-people/design-tokens/mobile';

/** A thin bar for "n of N"; the words beside it carry the same count (WCAG 1.4.1). */
export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;
  return (
    <View
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surfaceVariant },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
});
