import type { AppointmentSlot } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatSpan, MenuRow, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { slotsByDay } from './labels';

/** Where and how a slot's meeting happens, in the member's language. */
export function useSlotPlace(): (slot: AppointmentSlot) => string {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (slot) =>
    slot.mode === 'phone_call'
      ? t('m.representatives.mode_phone_call')
      : t('m.representatives.inPersonAt', { place: localized(slot.placeEn ?? '', slot.placeTa ?? '') });
}

/** Free slots under their Sri Lankan date; choosing one calls onChoose (FR-APT-002). */
export function SlotList({ slots, onChoose }: { slots: readonly AppointmentSlot[]; onChoose: (slot: AppointmentSlot) => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const place = useSlotPlace();
  return (
    <View style={styles.days}>
      {slotsByDay(slots, language).map(([day, items]) => (
        <View key={day} style={styles.day}>
          <AppText step="label" accessibilityRole="header">
            {day}
          </AppText>
          <SurfaceCard style={styles.rows}>
            {items.map((slot, index) => (
              <MenuRow
                key={slot.id}
                first={index === 0}
                icon={slot.mode === 'phone_call' ? 'call-outline' : 'location-outline'}
                tint="teal"
                label={formatSpan(slot.startsAt, slot.endsAt, language)}
                hint={`${place(slot)}. ${t('m.representatives.chooseTime')}`}
                onPress={() => onChoose(slot)}
              />
            ))}
          </SurfaceCard>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  days: { gap: spacing[4] },
  day: { gap: spacing[2] },
  rows: { paddingVertical: 0 },
});
