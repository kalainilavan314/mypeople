import type { FieldVisitConcern } from '@my-people/api-client';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDateTime,
  Notice,
  Screen,
  SelectField,
  SurfaceCard,
  TextField,
  useApiAction,
  useLanguage,
  useMember,
} from '@my-people/mobile-ui';

import { FieldError } from '@/components/FieldError';
import { QueryView } from '@/components/QueryView';
import { ToggleChips } from '@/components/ToggleChips';
import { CASE_NUMBER, CONCERNS, LIMITS } from '@/features/staff/fieldVisits/concerns';
import { FieldAccess } from '@/features/staff/fieldVisits/FieldAccess';
import { encryptedOnDevice } from '@/features/staff/fieldVisits/secureChunks';
import { usePlaceOptions } from '@/features/staff/fieldVisits/usePlaceOptions';
import { blankIfDeclined, saveVisit, useLocalVisits, type LocalVisit } from '@/features/staff/fieldVisits/visitStore';

function backToVisits() {
  if (router.canGoBack()) router.back();
  else router.replace('/staff/field-visits');
}

function newVisit(): LocalVisit {
  return {
    clientId: Crypto.randomUUID(),
    baseVersion: null,
    gnCode: '',
    dsCode: '',
    noPlace: false,
    visitedAt: new Date().toISOString(),
    consent: 'given',
    concerns: [],
    notes: '',
    placeText: '',
    followUp: '',
    caseNumber: '',
    confirmedNotPolitical: false,
    status: 'pending',
    problems: [],
    server: null,
  };
}

/**
 * S05, S06 Record a field visit, or (?clientId=) change one still on the phone. Consent comes first:
 * if the person declines, only the place and the time are kept, on the phone as on the server
 * (FR-FLD-004). The place is optional and chosen by hand: a GN or a DS division of the coordinator's
 * areas, or none when they collect in one area only; the phone's location is never asked for. Saved
 * encrypted on the phone until it is synced (S07).
 */
export default function NewFieldVisitScreen() {
  return (
    <FieldAccess>
      <VisitLoader />
    </FieldAccess>
  );
}

function VisitLoader() {
  const { t } = useTranslation();
  const member = useMember();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const local = useLocalVisits(member.id);
  if (local === null) {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={t('m.common.loading')}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }
  const existing = clientId ? local.find((visit) => visit.clientId === clientId) : undefined;
  return <VisitForm key={existing?.clientId ?? 'new'} initial={existing ?? newVisit()} editing={existing !== undefined} memberId={member.id} />;
}

type Step = 'consent' | 'details';

function VisitForm({ initial, editing, memberId }: { initial: LocalVisit; editing: boolean; memberId: string }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { query: placeOptions, nameOf, singleArea, singleAreaText } = usePlaceOptions();
  const [visit, setVisit] = useState<LocalVisit>(initial);
  const [step, setStep] = useState<Step>(editing ? 'details' : 'consent');
  const [showErrors, setShowErrors] = useState(false);
  const save = useApiAction(async () => {
    // Changed notes are checked again; a confirmation given for the old words does not carry over.
    const notesChanged = visit.notes !== initial.notes || visit.followUp !== initial.followUp || visit.placeText !== initial.placeText;
    await saveVisit(
      memberId,
      blankIfDeclined({
        ...visit,
        status: 'pending',
        problems: [],
        server: null,
        confirmedNotPolitical: notesChanged ? false : visit.confirmedNotPolitical,
      }),
    );
    backToVisits();
  });
  const set = <K extends keyof LocalVisit>(key: K, value: LocalVisit[K]) => setVisit((current) => ({ ...current, [key]: value }));

  if (step === 'consent') {
    return (
      <Screen edges={['bottom']} maxContentWidth={720}>
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('s.fieldVisits.consentQuestion')}
          </AppText>
          <AppText step="secondary" tone="secondary">
            {t('s.fieldVisits.consentExplain')}
          </AppText>
          <Button
            label={t('s.fieldVisits.consentYes')}
            icon="checkmark"
            onPress={() => {
              set('consent', 'given');
              setStep('details');
            }}
          />
          <Button
            label={t('s.fieldVisits.consentNo')}
            variant="secondary"
            onPress={() => {
              set('consent', 'declined');
              setStep('details');
            }}
          />
        </SurfaceCard>
      </Screen>
    );
  }

  const declined = visit.consent === 'declined';
  // A visit with no place is allowed only while the coordinator collects in exactly one area.
  const placeValue = visit.gnCode ? `gn:${visit.gnCode}` : visit.dsCode ? `ds:${visit.dsCode}` : visit.noPlace && singleArea ? 'none' : null;
  const choosePlace = (value: string) => {
    const [level, code = ''] = value.split(':');
    setVisit((current) => ({
      ...current,
      gnCode: level === 'gn' ? code : '',
      dsCode: level === 'ds' ? code : '',
      noPlace: value === 'none',
    }));
  };
  const problems = {
    place: placeValue === null,
    concerns: !declined && visit.concerns.length === 0,
    caseNumber: !declined && visit.caseNumber.trim() !== '' && !CASE_NUMBER.test(visit.caseNumber.trim()),
  };
  const submit = () => {
    if (problems.place || problems.concerns || problems.caseNumber) {
      setShowErrors(true);
      return;
    }
    void save.run();
  };

  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <Notice tone="warning">{t('s.fieldVisits.noPolitics')}</Notice>
      <SurfaceCard style={styles.card}>
        <AppText step="label">{t('s.fieldVisits.consentAnswer')}</AppText>
        <AppText step="body">{declined ? t('s.fieldVisits.consentDeclined') : t('s.fieldVisits.consentGiven')}</AppText>
        {declined ? (
          <AppText step="secondary" tone="muted">
            {t('s.fieldVisits.declinedKeeps')}
          </AppText>
        ) : null}
        <Button label={t('s.fieldVisits.changeConsent')} variant="quiet" onPress={() => setStep('consent')} />
        <AppText step="caption" tone="muted">
          {t('s.fieldVisits.visitedAt', { time: formatDateTime(visit.visitedAt, language) })}
        </AppText>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <QueryView query={placeOptions}>
          {(data) => (
            <>
              <SelectField
                label={t('s.fieldVisits.placeChoice')}
                placeholder={singleArea ? t('s.fieldVisits.choosePlaceOrNone') : t('s.fieldVisits.choosePlace')}
                value={placeValue}
                options={[
                  ...(singleAreaText ? [{ value: 'none', label: t('s.fieldVisits.noPlaceOption', { area: singleAreaText }) }] : []),
                  ...data.options.map((option) => ({ value: option.key, label: nameOf(option.key) })),
                ]}
                onChange={choosePlace}
                error={showErrors && problems.place ? t('s.fieldVisits.placeError') : null}
              />
              {data.saved ? (
                <AppText step="caption" tone="muted">
                  {t('s.fieldVisits.savedList')}
                </AppText>
              ) : null}
            </>
          )}
        </QueryView>
        <AppText step="secondary" tone="muted">
          {singleArea ? t('s.fieldVisits.placeOptional') : t('s.fieldVisits.placeNeeded')} {t('s.fieldVisits.noLocation')}
        </AppText>
      </SurfaceCard>

      {declined ? null : (
        <>
          <SurfaceCard style={styles.card}>
            <AppText step="section" accessibilityRole="header">
              {t('s.fieldVisits.concerns')}
            </AppText>
            <ToggleChips
              label={t('s.fieldVisits.concerns')}
              selected={visit.concerns}
              onChange={(concerns: FieldVisitConcern[]) => set('concerns', concerns)}
              options={CONCERNS.map((key) => ({ key, label: t(`s.fieldVisits.concern_${key}`) }))}
            />
            {showErrors && problems.concerns ? <FieldError text={t('s.fieldVisits.concernsError')} /> : null}
          </SurfaceCard>
          <SurfaceCard style={styles.card}>
            <TextField
              label={t('s.fieldVisits.notes')}
              hint={t('s.fieldVisits.notesHint')}
              optional
              value={visit.notes}
              multiline
              textAlignVertical="top"
              maxLength={LIMITS.notesMax}
              onChangeText={(text) => set('notes', text)}
            />
            <TextField
              label={t('s.fieldVisits.place')}
              hint={t('s.fieldVisits.placeHint')}
              optional
              value={visit.placeText}
              maxLength={LIMITS.placeMax}
              onChangeText={(text) => set('placeText', text)}
            />
            <TextField
              label={t('s.fieldVisits.followUp')}
              optional
              value={visit.followUp}
              multiline
              textAlignVertical="top"
              maxLength={LIMITS.followUpMax}
              onChangeText={(text) => set('followUp', text)}
            />
            <TextField
              label={t('s.fieldVisits.caseNumber')}
              hint={t('s.fieldVisits.caseNumberHint')}
              optional
              value={visit.caseNumber}
              autoCapitalize="characters"
              maxLength={20}
              onChangeText={(text) => set('caseNumber', text.toUpperCase())}
              error={showErrors && problems.caseNumber ? t('s.fieldVisits.caseNumberError') : null}
            />
          </SurfaceCard>
        </>
      )}

      <AppText step="caption" tone="muted">
        {encryptedOnDevice ? t('s.fieldVisits.encrypted') : t('s.fieldVisits.webMemoryOnly')}
      </AppText>
      {save.error ? <Notice tone="error">{t('s.fieldVisits.notSaved')}</Notice> : null}
      <Button label={t('s.fieldVisits.save')} icon="save-outline" busy={save.busy} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  loading: { paddingVertical: spacing[8], alignItems: 'center' },
});
