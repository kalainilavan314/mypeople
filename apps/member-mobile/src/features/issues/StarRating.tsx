import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control } from '@my-people/design-tokens/mobile';

const STARS = [1, 2, 3, 4, 5] as const;

type Props = { value: number | null; onChange: (value: number) => void; label: string };

/** One to five stars, each a radio button named "3 of 5 stars", 44 points square (WCAG 2.5.8, 4.1.2). */
export function StarRating({ value, onChange, label }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {STARS.map((star) => {
        const filled = value !== null && star <= value;
        const checked = value === star;
        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            aria-checked={checked}
            accessibilityLabel={t('m.issues.stars', { count: star })}
            style={styles.star}>
            <Ionicons name={filled ? 'star' : 'star-outline'} size={28} color={filled ? colors.primary : colors.controlBorder} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  star: { width: control.touchMin, height: control.touchMin, alignItems: 'center', justifyContent: 'center' },
});
