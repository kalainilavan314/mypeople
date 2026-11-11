import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@my-people/design-tokens/mobile';

import { useLanguage } from '../hooks/useLanguage';
import { dateBadgeParts } from '../lib/format';

import { AppText } from './AppText';

/** A navy 48 × 56 date tile; the full date is its accessible name. */
export function DateBadge({ iso }: { iso: string }) {
  const language = useLanguage();
  const parts = dateBadgeParts(iso, language);
  return (
    <View style={styles.badge} accessible accessibilityLabel={parts.full}>
      <AppText step="section" tone="inverse" weight={500}>
        {parts.day}
      </AppText>
      <AppText step="caption" tone="inverse" style={styles.month}>
        {parts.month}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 48,
    minHeight: 56,
    borderRadius: radius.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: { textTransform: 'capitalize' },
});
