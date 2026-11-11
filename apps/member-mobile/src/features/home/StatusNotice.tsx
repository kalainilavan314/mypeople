import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';

import { AppText } from '@my-people/mobile-ui';

type Props = {
  title: string;
  body: string;
  link: string;
  onPress: () => void;
};

/** The amber "Verification under review" card: the whole card opens the next step, as its link says. */
export function StatusNotice({ title, body, link, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${body} ${link}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Ionicons name="information-circle-outline" size={24} color={colors.warningText} />
      <View style={styles.text}>
        <AppText step="card" weight={400}>
          {title}
        </AppText>
        <AppText step="secondary" tone="warning">
          {body}
        </AppText>
        <AppText step="body" tone="link">
          {link}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.warningText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningBackground,
  },
  pressed: { backgroundColor: colors.warningBorder },
  text: { flex: 1, gap: 2 },
});
