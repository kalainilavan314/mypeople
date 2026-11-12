import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@my-people/design-tokens/mobile';

/**
 * Leaves the Staff section for the member screens. The section is one screen on top of the
 * member tabs, so going back to "/" closes it whichever staff tab or screen is showing; opened
 * from a link with nothing underneath, the member Home takes its place.
 */
export function leaveStaffSection() {
  router.dismissTo('/');
}

/** The header button on every staff tab that leaves the Staff section. */
export function LeaveStaffButton() {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={leaveStaffSection}
      accessibilityRole="button"
      accessibilityLabel={t('s.common.backToApp')}
      hitSlop={8}
      style={styles.button}>
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});
