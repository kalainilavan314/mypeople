import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

type Props = {
  /** This device's copy; null when only the server still has it. */
  uri: string | null;
  number: number;
  uploaded?: boolean;
  onRemove?: () => void;
};

/** One attached photo: a small preview, whether it was sent, and a remove control when it can still change. */
export function PhotoThumb({ uri, number, uploaded = false, onRemove }: Props) {
  const { t } = useTranslation();
  const label = t('m.issues.photoLabel', { number });
  return (
    <View style={styles.thumb}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" accessibilityLabel={label} />
      ) : (
        <View style={styles.placeholder} accessible accessibilityRole="image" accessibilityLabel={label}>
          <Ionicons name="image-outline" size={28} color={colors.textMuted} />
        </View>
      )}
      {uploaded ? (
        <AppText step="caption" tone="success">
          {t('m.issues.photoUploaded')}
        </AppText>
      ) : null}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('m.issues.removePhoto', { number })}
          hitSlop={4}
          style={styles.remove}>
          <Ionicons name="close" size={18} color={colors.onPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const SIZE = 96;

const styles = StyleSheet.create({
  thumb: { width: SIZE, gap: spacing[1] },
  image: { width: SIZE, height: SIZE, borderRadius: radius.card, backgroundColor: colors.surfaceVariant },
  placeholder: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: control.touchMin,
    height: control.touchMin,
    borderTopRightRadius: radius.card,
    borderBottomLeftRadius: radius.card,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
