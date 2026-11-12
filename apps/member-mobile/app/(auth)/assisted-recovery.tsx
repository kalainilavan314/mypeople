import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Button, ChipRow, Notice, Screen, TextField, useApiAction } from '@my-people/mobile-ui';

import { accountNumber, IdRouteFields, type IdNumber } from '@/features/auth/IdRouteFields';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Method = 'phone' | 'email' | 'in_person';

/** A16: when the recovery number is gone, a reviewer in the member's area helps, with a reference to keep (FR-AUTH-017). */
export default function AssistedRecoveryScreen() {
  const { t } = useTranslation();
  const [id, setId] = useState<IdNumber>({ route: 'nic', number: '', country: '' });
  const [method, setMethod] = useState<Method>('phone');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const contactValid = method === 'in_person'
    || (method === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim()) : contact.replace(/\D/g, '').length >= 9);
  const send = useApiAction(async () => {
    const result = await api().requestAssistedRecovery({
      ...accountNumber(id),
      contactMethod: method,
      contactValue: method === 'in_person' ? null : contact.trim(),
      message: message.trim() || null,
    });
    setReference(result.reference);
  });

  if (reference) {
    return (
      <Screen edges={['bottom']} maxContentWidth={560}>
        <Notice tone="success">{t('m.recover.requested')}</Notice>
        <AppText step="label">{t('m.recover.requestReference')}</AppText>
        <AppText step="section" mono>{reference}</AppText>
        <AppText step="secondary" tone="muted">{t('m.recover.keepReference')}</AppText>
        <Button label={t('m.signIn.submit')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} maxContentWidth={560}>
      <AppText step="secondary" tone="muted">
        {t('m.recover.assistedSubtitle')}
      </AppText>
      <IdRouteFields value={id} onChange={setId} />
      <AppText step="label">{t('m.recover.contactMethod')}</AppText>
      <ChipRow
        label={t('m.recover.contactMethod')}
        selected={method}
        onSelect={setMethod}
        options={[
          { key: 'phone', label: t('m.recover.contactPhone') },
          { key: 'email', label: t('m.recover.contactEmail') },
          { key: 'in_person', label: t('m.recover.contactInPerson') },
        ]}
      />
      {method !== 'in_person' ? (
        <TextField
          label={t('m.recover.contactValue')}
          value={contact}
          onChangeText={setContact}
          keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
          autoCapitalize="none"
        />
      ) : null}
      <TextField
        label={t('m.recover.message')}
        optional
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={500}
      />
      {send.error ? <Notice tone="error">{errorMessage(t, send.error)}</Notice> : null}
      <Button
        label={t('m.recover.sendRequest')}
        busy={send.busy}
        busyLabel={t('m.common.sending')}
        disabled={id.number.trim() === '' || !contactValid}
        onPress={() => void send.run()}
      />
    </Screen>
  );
}
import { router } from 'expo-router';
