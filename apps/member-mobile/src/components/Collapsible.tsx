import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, control, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

/** A heading that opens and closes the long text under it, such as a transcript. */
export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.box}>
      <Pressable
        onPress={() => setOpen((shown) => !shown)}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        style={styles.header}>
        <AppText step="card" style={styles.flex}>
          {title}
        </AppText>
        <Ionicons accessible={false} name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
      </Pressable>
      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[2] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: control.touchMin },
  flex: { flex: 1 },
});
