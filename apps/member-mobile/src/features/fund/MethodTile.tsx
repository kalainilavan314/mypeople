import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@my-people/mobile-ui';

import { fundColors, fundStyles } from './fundStyle';

/** A square choice tile with a label under it, as the payment method tiles in the design. */
export function MethodTile({ icon, label, selected, onPress, accessibilityRole = 'radio' }: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityRole?: 'radio' | 'button';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      accessibilityState={accessibilityRole === 'radio' ? { checked: selected } : undefined}
      style={styles.wrap}>
      {({ pressed }) => (
        <>
          <View style={[fundStyles.box, styles.tile, selected && styles.selected, pressed && styles.pressed]}>
            <Ionicons name={icon} size={26} color={fundColors.ink} />
          </View>
          <AppText step="caption" style={[styles.label, selected && styles.labelSelected]}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 8 },
  tile: { width: '100%', height: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  selected: { borderColor: fundColors.ink },
  pressed: { opacity: 0.8 },
  label: { color: fundColors.muted, textAlign: 'center' },
  labelSelected: { color: fundColors.ink },
});
