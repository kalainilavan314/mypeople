import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChipRow } from '@/components/ChipRow';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { accountNumber, IdRouteFields, type IdNumber } from '@/features/auth/IdRouteFields';
import { useApiAction } from '@/hooks/useApi';
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
      <Screen edges={['bottom']}>
        <Notice tone="success">{t('m.recover.requested', { reference })}</Notice>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
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
        disabled={id.number.trim() === '' || (method !== 'in_person' && contact.trim() === '')}
        onPress={() => void send.run()}
      />
    </Screen>
  );
}
