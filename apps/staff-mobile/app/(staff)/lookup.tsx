import { ApiError, type MemberLookup } from '@my-people/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Notice, Screen, StatusTag, SurfaceCard, TextField, useApiAction } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * S03: one member by exact member ID, only in the person's areas, with minimal
 * fields and no list (FR-STF-003, SG-02). Every lookup is recorded.
 */
export default function LookupScreen() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<MemberLookup | null>(null);
  const [missing, setMissing] = useState(false);
  const find = useApiAction(async () => {
    setFound(null);
    setMissing(false);
    try {
      setFound(await api().lookupMember(code.trim()));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setMissing(true);
      else throw error;
    }
  });

  return (
    <Screen edges={['bottom']}>
      <AppText step="secondary" tone="muted">
        {t('s.lookup.body')}
      </AppText>
      <TextField
        label={t('s.lookup.memberId')}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        onSubmitEditing={() => void find.run()}
      />
      <Button label={t('s.lookup.find')} busy={find.busy} disabled={code.trim().length < 3} onPress={() => void find.run()} />
      {missing ? <Notice tone="info">{t('s.lookup.notFound')}</Notice> : null}
      {find.error ? <Notice tone="error">{errorMessage(t, find.error)}</Notice> : null}
      {found ? (
        <SurfaceCard>
          <AppText step="section">{found.fullName}</AppText>
          <AppText step="secondary" tone="muted" mono>
            {found.memberCode}
          </AppText>
          <AppText step="secondary" tone="secondary">
            {[found.districtName, found.gnName].filter(Boolean).join(' / ')}
          </AppText>
          <StatusTag
            tone={found.identityVerified ? 'verified' : 'pending'}
            label={found.identityVerified ? t('s.lookup.identity') : t('s.lookup.identityNo')}
          />
          <StatusTag
            tone={found.membershipState === 'active' ? 'verified' : 'neutral'}
            label={t('s.lookup.membership', { state: t(`s.lookup.state_${found.membershipState}`) })}
          />
        </SurfaceCard>
      ) : null}
    </Screen>
  );
}
