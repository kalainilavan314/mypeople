import type { PublicSupportForm } from '@my-people/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, LanguageToggle, Screen, SurfaceCard, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { ReceiptCard } from '@/components/ReceiptCard';
import { EmergencyNumbers } from '@/features/support/EmergencyNumbers';
import { PublicStatistics } from '@/features/support/PublicStatistics';
import { RequestFlow } from '@/features/support/RequestFlow';
import { api } from '@/lib/api';
import { chooseLanguage } from '@/lib/i18n';

type Receipt = { caseRef: string; emergency: boolean };

/**
 * S11 public web form (https://app.tmk.lk/help/support): Community Support for anyone, without an
 * account. The official emergency numbers come first; membership is never needed or asked about, and
 * help never depends on membership, donations or political support (BR-102). The answer is only the
 * AS- reference; the team calls back on the phone number given. Below, D14's public figures.
 */
export default function PublicSupportScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const form = useApiQuery(() => api().getPublicSupportForm());
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      <View style={styles.language}>
        <LanguageToggle value={language} onChange={(choice) => void chooseLanguage(choice)} label={t('m.welcome.chooseLanguage')} />
      </View>
      <FeatureQueryView feature="support" query={form}>
        {(data) => <PublicSupport form={data} />}
      </FeatureQueryView>
    </Screen>
  );
}

function PublicSupport({ form }: { form: PublicSupportForm }) {
  const { t } = useTranslation();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // A new key starts the next request from the danger question with an empty form.
  const [attempt, setAttempt] = useState(0);

  return (
    <>
      <EmergencyNumbers contacts={form.emergencyContacts} lead={t('m.support.emergencyLead')} />
      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('m.support.publicHeading')}
        </AppText>
        <AppText step="body" tone="secondary">
          {t('m.support.publicIntro')}
        </AppText>
        <AppText step="secondary" tone="secondary">
          {t('m.support.neverDepends')}
        </AppText>
      </SurfaceCard>

      {receipt ? (
        <ReceiptCard
          title={t('m.support.receiptTitle')}
          referenceLabel={t('m.support.reference')}
          reference={receipt.caseRef}
          body={
            receipt.emergency
              ? `${t('m.support.receiptEmergency')} ${t('m.support.publicReceiptBody')}`
              : t('m.support.publicReceiptBody')
          }>
          <Button
            label={t('m.support.sendAnother')}
            variant="secondary"
            onPress={() => {
              setReceipt(null);
              setAttempt((count) => count + 1);
            }}
          />
        </ReceiptCard>
      ) : (
        <RequestFlow
          key={attempt}
          contacts={form.emergencyContacts}
          categories={form.categories}
          initialCategory={null}
          publicForm
          onSend={async (input) => {
            const sent = await api().requestSupportPublicly(input);
            setReceipt({ caseRef: sent.caseRef, emergency: input.emergency ?? false });
          }}
        />
      )}

      <PublicStatistics />

      <View style={styles.members}>
        <AppText step="secondary" tone="muted">
          {t('m.support.membersNote')}
        </AppText>
        <Button label={t('m.support.openApp')} variant="quiet" onPress={() => router.push('/')} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  language: { alignItems: 'flex-end' },
  card: { gap: spacing[3] },
  members: { gap: spacing[1] },
});
