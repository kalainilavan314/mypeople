import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

type Props = { ok: boolean; title: string; name?: string | null; memberCode?: string | null };

/**
 * The scan result in large type for a busy entrance. A name and member ID
 * appear only for a recorded check-in or a valid card (BR-062, FR-ADM-001).
 */
export function ResultBanner({ ok, title, name, memberCode }: Props) {
  return (
    <View
      style={[styles.banner, ok ? styles.ok : styles.refused]}
      accessibilityRole={ok ? undefined : 'alert'}
      accessibilityLiveRegion="assertive">
      <View style={styles.titleRow}>
        <Ionicons
          name={ok ? 'checkmark-circle' : 'alert-circle'}
          size={28}
          color={ok ? colors.success : colors.error}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <AppText step="page" tone={ok ? 'success' : 'error'}>{title}</AppText>
      </View>
      {name ? <AppText step="section">{name}</AppText> : null}
      {memberCode ? (
        <AppText step="body" tone="secondary" mono>
          {memberCode}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.card, borderWidth: 2, padding: spacing[4], gap: spacing[1] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ok: { borderColor: colors.success, backgroundColor: colors.successBackground },
  refused: { borderColor: colors.error, backgroundColor: colors.errorBackground },
});
