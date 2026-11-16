import type { VolunteerContactInput } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { Button, confirmAction, Notice, TextField, useApiAction } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

import { CONTACT_MAX, CONTACT_MIN } from './labels';

type Kind = VolunteerContactInput['kind'];

/**
 * "Contact coordinator" and, once confirmed, "Request a change" (FR-VOL-007, 008). Both go through
 * the app, so no phone number is shown either way. A change request needs its reason and a second
 * "yes" in a dialog, so one accidental tap sends nothing; the assignment stays as it is until the
 * coordinator answers.
 */
export function ContactCoordinator({ offerId, confirmed, onSent }: { offerId: string; confirmed: boolean; onSent: () => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<Kind | null>(null);
  const [body, setBody] = useState('');
  const [showError, setShowError] = useState(false);
  const [sent, setSent] = useState<Kind | null>(null);

  const send = useApiAction(async (sending: Kind) => {
    if (sending === 'change_request') {
      const yes = await confirmAction({
        title: t('m.volunteer.changeConfirmTitle'),
        message: t('m.volunteer.changeConfirmBody'),
        confirmLabel: t('m.volunteer.sendChange'),
        cancelLabel: t('m.common.cancel'),
      });
      if (!yes) return;
    }
    await api().contactVolunteerCoordinator(offerId, { kind: sending, body: body.trim(), confirmed: true });
    setSent(sending);
    setKind(null);
    setBody('');
    setShowError(false);
    onSent();
  });

  const open = (next: Kind) => {
    setSent(null);
    send.clearError();
    setKind(next);
  };

  if (!kind) {
    return (
      <View style={styles.group}>
        {sent ? (
          <Notice tone="success">{sent === 'message' ? t('m.volunteer.messageSent') : t('m.volunteer.changeSent')}</Notice>
        ) : null}
        <Button label={t('m.volunteer.contactCoordinator')} variant="secondary" icon="chatbubble-outline" onPress={() => open('message')} />
        {confirmed ? (
          <Button label={t('m.volunteer.requestChange')} variant="secondary" icon="swap-horizontal-outline" onPress={() => open('change_request')} />
        ) : null}
      </View>
    );
  }

  const short = body.trim().length < CONTACT_MIN;
  const change = kind === 'change_request';
  const submit = () => {
    if (short) {
      setShowError(true);
      return;
    }
    void send.run(kind);
  };

  return (
    <View style={styles.group}>
      <TextField
        label={change ? t('m.volunteer.changeReasonLabel') : t('m.volunteer.messageLabel')}
        hint={change ? t('m.volunteer.changeReasonHint', { min: CONTACT_MIN }) : t('m.volunteer.messageHint', { min: CONTACT_MIN })}
        value={body}
        multiline
        textAlignVertical="top"
        maxLength={CONTACT_MAX}
        onChangeText={setBody}
        error={showError && short ? t('m.volunteer.contactTooShort', { min: CONTACT_MIN }) : null}
      />
      {send.error ? <Notice tone="error">{errorMessage(t, send.error, 'volunteer')}</Notice> : null}
      <Button
        label={change ? t('m.volunteer.sendChange') : t('m.volunteer.sendMessage')}
        icon="send-outline"
        busy={send.busy}
        onPress={submit}
      />
      <Button label={t('m.common.cancel')} variant="quiet" disabled={send.busy} onPress={() => setKind(null)} />
    </View>
  );
}

const styles = StyleSheet.create({ group: { gap: spacing[2] } });
