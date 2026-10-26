import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@my-people/design-tokens';

import { useLanguage } from '@/hooks/useLanguage';
import { dateBadgeParts } from '@/lib/format';

import { AppText } from './AppText';

/** A 44 × 50 date well; the full date is its accessible name (spec §3). */
export function DateBadge({ iso }: { iso: string }) {
  const language = useLanguage();
  const parts = dateBadgeParts(iso, language);
  return (
    <View style={styles.badge} accessible accessibilityLabel={parts.full}>
      <AppText step="caption" tone="primary" style={styles.month}>
        {parts.month}
      </AppText>
      <AppText step="section" tone="primary">
        {parts.day}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 44,
    minHeight: 50,
    borderRadius: radius.control,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: { textTransform: 'uppercase' },
});
