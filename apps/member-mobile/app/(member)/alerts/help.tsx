import type { SafetyHelpNeed, SafetyHelpReceipt } from '@my-people/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Checkbox,
  Notice,
  Screen,
  SelectField,
  SurfaceCard,
  TextField,
  useApiAction,
  useMember,
} from '@my-people/mobile-ui';

import { AreaFields, NO_AREA, type AreaChoice } from '@/features/area/AreaFields';
import { chosenArea } from '@/features/area/chosenArea';
import { CALL_FIRST, HELP_LIMITS, HELP_NEEDS, OFFLINE_EMERGENCY_CONTACTS } from '@/features/safety/labels';
import { NotDispatchNotice } from '@/features/safety/NotDispatchNotice';
import { EmergencyNumbers } from '@/features/support/EmergencyNumbers';
import { PHONE } from '@/features/support/labels';
import { api } from '@/lib/api';
import { errorMessage, featureClosed } from '@/lib/errors';

const isNeed = (value: string): value is SafetyHelpNeed => (HELP_NEEDS as readonly string[]).includes(value);

/**
 * M36 Emergency help request. The emergency numbers and the statement that this app sends no help come
 * first and work without a connection. The request becomes an urgent Community Support case that the
 * people screening requests in the area are told about at once (FR-DIS-007). Anyone signed in may ask;
 * membership, donations and political support are never asked about (BR-102).
 */
export default function EmergencyHelpScreen() {
  const { t } = useTranslation();
  const member = useMember();
  const { alertId } = useLocalSearchParams<{ alertId?: string }>();
  const [need, setNeed] = useState<SafetyHelpNeed | null>(null);
  const [people, setPeople] = useState('1');
  const [details, setDetails] = useState('');
  const [fullName, setFullName] = useState(member.fullName ?? '');
  const [phone, setPhone] = useState('');
  const [elsewhere, setElsewhere] = useState(false);
  const [area, setArea] = useState<AreaChoice>(NO_AREA);
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [receipt, setReceipt] = useState<SafetyHelpReceipt | null>(null);

  const count = Number(people);
  const problems = {
    need: !need,
    people: !/^\d{1,3}$/.test(people.trim()) || count < 1 || count > HELP_LIMITS.peopleMax,
    details: details.trim().length < HELP_LIMITS.detailsMin,
    name: fullName.trim().length < HELP_LIMITS.nameMin,
    phone: phone.trim() !== '' && !PHONE.test(phone.trim()),
    area: elsewhere && !area.district,
    consent: !consent,
  };
  const send = useApiAction(async () => {
    if (!need) return;
    const sent = await api().requestEmergencyHelp({
      need,
      people: count,
      details: details.trim(),
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      area: elsewhere ? chosenArea(area) : null,
      alertId: alertId || null,
      consent,
    });
    setReceipt(sent);
  });
  const submit = () => {
    if (Object.values(problems).some(Boolean)) {
      setShowErrors(true);
      return;
    }
    void send.run();
  };

  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <NotDispatchNotice />
      <EmergencyNumbers contacts={[...OFFLINE_EMERGENCY_CONTACTS]} lead={t('m.safety.helpCallFirst')} />

      {receipt ? (
        <SurfaceCard style={styles.card}>
          <Notice tone="success" title={t('m.safety.helpSentTitle')}>
            {t('m.safety.helpSentBody', { ref: receipt.caseRef })}
          </Notice>
          <AppText step="secondary" tone="secondary">
            {t('m.safety.helpSentNotDispatch')}
          </AppText>
          <Button
            label={t('m.safety.followRequest')}
            icon="document-text-outline"
            onPress={() => router.replace({ pathname: '/support/[id]', params: { id: receipt.caseId } })}
          />
        </SurfaceCard>
      ) : featureClosed(send.error) ? (
        <Notice tone="info" title={t('m.safety.notOpenTitle')}>
          {t('m.safety.notOpenBody')}
        </Notice>
      ) : (
        <View style={styles.body}>
          <AppText step="body" tone="secondary">
            {t('m.safety.helpFormIntro')}
          </AppText>
          <SurfaceCard style={styles.card}>
            <SelectField
              label={t('m.safety.needLabel')}
              placeholder={t('m.safety.needChoose')}
              value={need}
              options={HELP_NEEDS.map((key) => ({ value: key, label: t(`m.safety.need_${key}`) }))}
              onChange={(value) => setNeed(isNeed(value) ? value : null)}
              error={showErrors && problems.need ? t('m.safety.needError') : null}
            />
            {need && CALL_FIRST.has(need) ? <Notice tone="error">{t(`m.safety.callFirst_${need}`)}</Notice> : null}
            <TextField
              label={t('m.safety.peopleLabel')}
              value={people}
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setPeople}
              error={showErrors && problems.people ? t('m.safety.peopleError', { max: HELP_LIMITS.peopleMax }) : null}
            />
            <TextField
              label={t('m.safety.detailsLabel')}
              hint={t('m.safety.detailsHint', { min: HELP_LIMITS.detailsMin })}
              value={details}
              multiline
              textAlignVertical="top"
              maxLength={HELP_LIMITS.detailsMax}
              onChangeText={setDetails}
              error={showErrors && problems.details ? t('m.safety.detailsError', { min: HELP_LIMITS.detailsMin }) : null}
            />
          </SurfaceCard>

          <SurfaceCard style={styles.card}>
            <AppText step="section" accessibilityRole="header">
              {t('m.safety.contactHeading')}
            </AppText>
            <TextField
              label={t('m.safety.nameLabel')}
              hint={t('m.safety.nameHint')}
              value={fullName}
              maxLength={HELP_LIMITS.nameMax}
              autoComplete="name"
              onChangeText={setFullName}
              error={showErrors && problems.name ? t('m.safety.nameError') : null}
            />
            <TextField
              label={t('m.safety.phoneLabel')}
              hint={t('m.safety.phoneHint')}
              optional
              value={phone}
              keyboardType="phone-pad"
              maxLength={16}
              onChangeText={setPhone}
              error={showErrors && problems.phone ? t('m.safety.phoneError') : null}
            />
            <Checkbox label={t('m.safety.elsewhere')} checked={elsewhere} onChange={setElsewhere} />
            {elsewhere ? (
              <AreaFields value={area} onChange={setArea} error={showErrors && problems.area ? t('m.safety.areaError') : null} />
            ) : (
              <AppText step="secondary" tone="muted">
                {t('m.safety.homeAreaUsed')}
              </AppText>
            )}
          </SurfaceCard>

          <SurfaceCard style={styles.card}>
            <Checkbox label={t('m.safety.consentLabel')} checked={consent} onChange={setConsent} />
            {showErrors && problems.consent ? (
              <AppText step="secondary" tone="error">
                {t('m.safety.consentError')}
              </AppText>
            ) : null}
            <AppText step="secondary" tone="secondary">
              {t('m.safety.neverDepends')}
            </AppText>
            {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'safety')}</Notice> : null}
            <Button label={t('m.safety.sendHelp')} busy={send.busy} busyLabel={t('m.common.sending')} onPress={submit} />
          </SurfaceCard>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  card: { gap: spacing[3] },
});
