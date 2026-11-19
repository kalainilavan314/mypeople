import type { BudgetReceiptCheck } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, SurfaceCard, TextField, useApiAction } from '@my-people/mobile-ui';

import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * FR-PBG-005: a receipt code confirms a ballot is in the counted chain (and, later, that the
 * totals were certified) without ever showing the choice.
 */
export function ReceiptCheck({ cycleId, initialCode }: { cycleId: string; initialCode?: string | null }) {
  const { t } = useTranslation();
  const [code, setCode] = useState(initialCode ?? '');
  const [answer, setAnswer] = useState<BudgetReceiptCheck | null>(null);
  const check = useApiAction(async () => {
    setAnswer(null);
    const found = await api().checkBudgetReceipt(cycleId, code.trim());
    setAnswer(found);
  });
  const cleaned = code.replace(/[^A-Za-z0-9]/g, '');

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.budgeting.checkTitle')}
      </AppText>
      <TextField
        label={t('m.budgeting.checkLabel')}
        hint={t('m.budgeting.checkHint')}
        value={code}
        onChangeText={(value) => {
          setCode(value);
          setAnswer(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
      />
      {check.error ? <Notice tone="error">{errorMessage(t, check.error, 'budgeting')}</Notice> : null}
      {answer ? (
        <Notice tone={answer.counted ? 'success' : 'warning'}>
          {answer.certified
            ? t('m.budgeting.checkCertified')
            : answer.counted
              ? t('m.budgeting.checkCounted')
              : t('m.budgeting.checkNotFound')}
        </Notice>
      ) : null}
      <Button
        label={t('m.budgeting.check')}
        variant="secondary"
        icon="shield-checkmark-outline"
        busy={check.busy}
        disabled={cleaned.length !== 16}
        onPress={() => void check.run()}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing[3] } });
