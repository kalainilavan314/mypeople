import { StyleSheet, View } from 'react-native';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button } from '@my-people/mobile-ui';

/** A section's heading on a page, with an optional quiet action at its end ("See all"). */
export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <AppText step="section" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      {actionLabel && onAction ? <Button label={actionLabel} variant="quiet" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  title: { flex: 1 },
});
