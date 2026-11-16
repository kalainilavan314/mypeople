import Ionicons from '@expo/vector-icons/Ionicons';
import type { SupportHome } from '@my-people/api-client';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, spacing } from '@my-people/design-tokens/mobile';
import { AppText, SurfaceCard, useLocalized } from '@my-people/mobile-ui';

type Contact = SupportHome['emergencyContacts'][number];

/**
 * The official emergency numbers, each a tap to call (FR-AST-003). They come before anything else,
 * because an app request is never a substitute for emergency services.
 */
export function EmergencyNumbers({ contacts, lead }: { contacts: Contact[]; lead: string }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons accessible={false} name="call-outline" size={22} color={colors.error} />
        <AppText step="section" accessibilityRole="header" style={styles.flex}>
          {t('m.support.emergencyTitle')}
        </AppText>
      </View>
      <AppText step="secondary" tone="secondary">
        {lead}
      </AppText>
      {contacts.map((contact) => {
        const name = localized(contact.nameEn, contact.nameTa);
        return (
          <Pressable
            key={contact.number}
            onPress={() => void Linking.openURL(`tel:${contact.number.replace(/\s/g, '')}`)}
            accessibilityRole="link"
            accessibilityLabel={t('m.support.callNumber', { name, number: contact.number })}
            style={({ pressed }) => [styles.contact, pressed && styles.pressed]}>
            <View style={styles.flex}>
              <AppText step="card">{name}</AppText>
            </View>
            <AppText step="section" tone="primary" mono>
              {contact.number}
            </AppText>
            <Ionicons accessible={false} name="call" size={20} color={colors.primary} />
          </Pressable>
        );
      })}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2], borderColor: colors.errorBorder },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
  contact: {
    minHeight: control.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: spacing[2],
  },
  pressed: { backgroundColor: colors.surfaceVariant },
});
