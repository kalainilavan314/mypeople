import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors, control } from '@my-people/design-tokens/mobile';

/**
 * The header's back arrow on the web, as a full 44 px target. The navigation library's own web
 * button is 30 px, below the app's touch-target rule; Android and iOS keep their native button.
 * Its colour is the header tint set in headerOptions (colors.primary).
 */
export function WebBackButton({ label }: { label: string }) {
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name="arrow-back" size={24} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: control.touchMin,
    height: control.touchMin,
    borderRadius: control.touchMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  pressed: { backgroundColor: colors.surfaceVariant },
});
