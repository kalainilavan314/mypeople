import type { AppointmentContactPreference, AppointmentNeed, AppointmentSlot, RepresentativeDetail } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  ChipRow,
  formatDate,
  formatSpan,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { DetailRow } from '@/components/DetailRow';
import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ToggleChips } from '@/components/ToggleChips';
import { CASE_REF, CONTACT_PREFERENCES, LIMITS, NEEDS, normalisePhone, PHONE } from '@/features/representatives/labels';
import { useSlotPlace } from '@/features/representatives/SlotList';
import { api } from '@/lib/api';
import { errorMessage, problemsOf } from '@/lib/errors';

/**
 * M42 Book an appointment: what to talk about, how to be contacted, any accessibility or language
 * needs (FR-APT-004) and, only if the member ticks consent, a case reference (FR-APT-005). The
 * booking then opens with reminders set for 24 hours and 1 hour before (FR-APT-003).
 */
export default function BookAppointmentScreen() {
  const { representativeId, slotId } = useLocalSearchParams<{ representativeId: string; slotId: string }>();
  const representative = useApiQuery(() => api().getRepresentative(representativeId), [representativeId]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <FeatureQueryView feature="representatives" query={representative}>
        {(data) => {
          const slot = data.slots.find((item) => item.id === slotId);
          // Someone else took it, or it was withdrawn, since the profile was opened.
          return slot ? <BookingForm representative={data} slot={slot} /> : <ChooseAnother representativeId={data.id} />;
        }}
      </FeatureQueryView>
    </Screen>
  );
}

function ChooseAnother({ representativeId }: { representativeId: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.body}>
      <Notice tone="warning" title={t('m.representatives.slotGoneTitle')}>
        {t('m.representatives.slotGoneBody')}
      </Notice>
      <Button
        label={t('m.representatives.chooseAnother')}
        icon="calendar-outline"
        onPress={() => router.replace({ pathname: '/representatives/[id]', params: { id: representativeId } })}
      />
    </View>
  );
}

function BookingForm({ representative, slot }: { representative: RepresentativeDetail; slot: AppointmentSlot }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const place = useSlotPlace();
  const [topic, setTopic] = useState('');
  const [preference, setPreference] = useState<AppointmentContactPreference>('in_app');
  const [phone, setPhone] = useState('');
  const [needs, setNeeds] = useState<AppointmentNeed[]>([]);
  const [needsNote, setNeedsNote] = useState('');
  const [linkCase, setLinkCase] = useState(false);
  const [caseRef, setCaseRef] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const book = useApiAction(async () => {
    const booked = await api().bookAppointment({
      slotId: slot.id,
      topic: topic.trim(),
      contactPreference: preference,
      contactPhone: preference === 'in_app' ? null : normalisePhone(phone),
      needs,
      needsNote: needsNote.trim() || null,
      // FR-APT-005: with consent unticked, no case reference leaves the phone.
      caseRef: linkCase ? caseRef.trim().toUpperCase() : null,
      caseLinkConsent: linkCase,
    });
    router.replace({ pathname: '/representatives/appointments/[id]', params: { id: booked.id, booked: '1' } });
  });

  const problems = {
    topic: topic.trim().length < LIMITS.topicMin,
    phone: preference !== 'in_app' && !PHONE.test(normalisePhone(phone)),
    caseRef: linkCase && !CASE_REF.test(caseRef.trim().toUpperCase()),
  };
  const slotTaken = problemsOf(book.error).some((code) => code === 'slot_taken' || code === 'slot_unavailable');

  return (
    <View style={styles.body}>
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.yourTime')}
        </AppText>
        <DetailRow
          label={t('m.representatives.with')}
          value={`${localized(representative.displayNameEn, representative.displayNameTa)} · ${localized(representative.roleEn, representative.roleTa)}`}
        />
        <DetailRow
          label={t('m.representatives.when')}
          value={`${formatDate(slot.startsAt, language)}, ${formatSpan(slot.startsAt, slot.endsAt, language)}`}
        />
        <DetailRow label={t('m.representatives.where')} value={place(slot)} />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <TextField
          label={t('m.representatives.topic')}
          hint={t('m.representatives.topicHint', { min: LIMITS.topicMin })}
          value={topic}
          multiline
          textAlignVertical="top"
          maxLength={LIMITS.topicMax}
          onChangeText={setTopic}
          error={showErrors && problems.topic ? t('m.representatives.topicError', { min: LIMITS.topicMin }) : null}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.contactPreference')}
        </AppText>
        <ChipRow
          label={t('m.representatives.contactPreference')}
          selected={preference}
          onSelect={setPreference}
          options={CONTACT_PREFERENCES.map((key) => ({ key, label: t(`m.representatives.contact_${key}`) }))}
        />
        {preference === 'in_app' ? (
          <AppText step="secondary" tone="secondary">
            {t('m.representatives.inAppHint')}
          </AppText>
        ) : (
          <TextField
            label={t('m.representatives.phone')}
            hint={t('m.representatives.phoneHint')}
            value={phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={16}
            onChangeText={setPhone}
            error={showErrors && problems.phone ? t('m.representatives.phoneError') : null}
          />
        )}
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.needs')}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('m.representatives.needsIntro')}
        </AppText>
        <ToggleChips
          label={t('m.representatives.needs')}
          options={NEEDS.map((key) => ({ key, label: t(`m.representatives.need_${key}`) }))}
          selected={needs}
          onChange={setNeeds}
        />
        <TextField
          label={t('m.representatives.needsNote')}
          optional
          value={needsNote}
          maxLength={LIMITS.needsNoteMax}
          onChangeText={setNeedsNote}
        />
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.representatives.caseTitle')}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('m.representatives.caseIntro')}
        </AppText>
        <Checkbox label={t('m.representatives.caseConsent')} checked={linkCase} onChange={setLinkCase} />
        {linkCase ? (
          <TextField
            label={t('m.representatives.caseRef')}
            hint={t('m.representatives.caseRefHint')}
            value={caseRef}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={30}
            onChangeText={setCaseRef}
            error={showErrors && problems.caseRef ? t('m.representatives.caseRefError') : null}
          />
        ) : null}
      </SurfaceCard>

      <Notice tone="info">{t('m.representatives.privacy')}</Notice>
      {book.error ? <Notice tone="error">{errorMessage(t, book.error, 'representatives')}</Notice> : null}
      {slotTaken ? <ChooseAnother representativeId={representative.id} /> : null}
      <Button
        label={t('m.representatives.bookButton')}
        icon="checkmark-circle-outline"
        busy={book.busy}
        onPress={() => {
          if (Object.values(problems).some(Boolean)) {
            setShowErrors(true);
            return;
          }
          void book.run();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  card: { gap: spacing[3] },
});
