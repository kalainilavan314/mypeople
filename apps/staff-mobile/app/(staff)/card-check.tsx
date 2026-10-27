import type { CardScan } from '@my-people/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Notice, Screen, useApiAction } from '@my-people/mobile-ui';

import { ResultBanner } from '@/features/scan/ResultBanner';
import { Scanner } from '@/features/scan/Scanner';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * FR-ADM-001, FR-STF-005: check a member's card. The answer is valid with the
 * display name and member ID only, expired, or not valid, never the reason.
 * There is no lookup by typed member ID here on purpose: it would let anyone
 * with this screen learn a member's status by guessing IDs.
 */
export default function CardCheckScreen() {
  const { t } = useTranslation();
  const [result, setResult] = useState<CardScan | null>(null);
  const scan = useApiAction(async (code: string) => setResult(await api().scanMemberCard(code)));

  return (
    <Screen edges={['bottom']}>
      <Scanner paused={result !== null || scan.busy} onScan={(code) => void scan.run(code)} />
      {result ? (
        <>
          <ResultBanner
            ok={result.result === 'valid'}
            title={t(`s.checkIn.card_${result.result}`)}
            name={result.displayName}
            memberCode={result.memberCode}
          />
          <Button label={t('s.checkIn.scanAgain')} icon="scan-outline" onPress={() => setResult(null)} />
        </>
      ) : null}
      {scan.error ? <Notice tone="error">{errorMessage(t, scan.error)}</Notice> : null}
    </Screen>
  );
}
