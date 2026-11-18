import { Share, StyleSheet, View } from 'react-native';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { ContributionDetail, ContributionReceipt } from '@my-people/api-client';
import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  type Tone,
  formatDateTime,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

type LoadedContribution = {
  contribution: ContributionDetail;
  receipt: ContributionReceipt | null;
};

const STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'pending',
  NEEDS_CORRECTION: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'error',
  HELD: 'pending',
};

export default function ContributionReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const language = useLanguage();

  const query = useApiQuery<LoadedContribution>(async () => {
    if (!id) throw new Error('Missing contribution id');
    const contribution = await api().getMyContribution(id);
    let receipt: ContributionReceipt | null = null;
    if (contribution.status === 'VERIFIED') {
      try {
        receipt = await api().getMyContributionReceipt(id);
      } catch {
        receipt = null;
      }
    }
    return { contribution, receipt };
  }, [id]);

  return (
    <Screen
      title={t('m.fund.receiptTitle')}
      maxContentWidth={720}
      onRefresh={query.reload}
      refreshing={query.loading && query.data !== undefined}>
      <QueryView query={query}>
        {({ contribution, receipt }) => (
          <ContributionDetailView
            contribution={contribution}
            receipt={receipt}
            language={language}
          />
        )}
      </QueryView>
    </Screen>
  );
}

function ContributionDetailView({
  contribution,
  receipt,
  language,
}: {
  contribution: ContributionDetail;
  receipt: ContributionReceipt | null;
  language: 'ta' | 'en';
}) {
  const { t } = useTranslation();
  const tone = STATUS_TONES[contribution.status] || 'neutral';
  const amountFormatted = `LKR ${(contribution.amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const statusLabel = t(`m.fund.status${toPascalCase(contribution.status)}` as any, contribution.status);
  const statusDesc = t(`m.fund.status${toPascalCase(contribution.status)}Desc` as any, '');

  const handleShareReceipt = async () => {
    if (!receipt) return;
    try {
      await Share.share({
        message: t('m.fund.receiptShareText', {
          code: receipt.receiptCode,
          amount: amountFormatted,
          date: receipt.transferDate,
          issued: formatDateTime(receipt.issuedAt, language),
        }),
      });
    } catch {
      // user cancelled or share failed
    }
  };

  return (
    <View style={styles.container}>
      {/* Reference & Review Status Card */}
      <SurfaceCard style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <AppText step="secondary" tone="muted">
              {t('m.fund.contributionReference')}
            </AppText>
            <AppText step="section" mono style={styles.monoRef}>
              {contribution.contributionRef}
            </AppText>
          </View>
          <StatusTag tone={tone} label={statusLabel} />
        </View>

        {statusDesc ? (
          <AppText step="body" tone="secondary">
            {statusDesc}
          </AppText>
        ) : null}

        {/* Explicit Pending Notice: Never label unverified contributions as official receipts */}
        {contribution.status !== 'VERIFIED' ? (
          <Notice tone="info">
            {t('m.fund.notOfficialReceipt')}
          </Notice>
        ) : null}
      </SurfaceCard>

      {/* Official Verified Receipt Card (Only shown after independent verification) */}
      {contribution.status === 'VERIFIED' && receipt ? (
        <SurfaceCard style={[styles.card, styles.verifiedCard]}>
          <View style={styles.receiptHeader}>
            <View style={styles.flex}>
              <AppText step="caption" tone="success">
                {t('m.fund.officialReceiptHeader')}
              </AppText>
              <AppText step="section" mono style={styles.receiptCodeText}>
                {receipt.receiptCode}
              </AppText>
            </View>
            <Ionicons name="shield-checkmark" size={32} color={colors.successText} />
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <AppText step="secondary" tone="muted">{t('m.fund.amountLabel')}</AppText>
            <AppText step="body" style={styles.amountText}>{amountFormatted}</AppText>
          </View>

          <View style={styles.metaRow}>
            <AppText step="secondary" tone="muted">{t('m.fund.transferDateLabel')}</AppText>
            <AppText step="body">{receipt.transferDate}</AppText>
          </View>

          <View style={styles.metaRow}>
            <AppText step="secondary" tone="muted">{t('m.fund.issuedDate')}</AppText>
            <AppText step="body">{formatDateTime(receipt.issuedAt, language)}</AppText>
          </View>

          <Button
            variant="primary"
            onPress={handleShareReceipt}
            label={t('m.fund.shareReceipt')}
          />
        </SurfaceCard>
      ) : null}

      {/* Submission Details Card */}
      <SurfaceCard style={styles.card}>
        <AppText step="card" style={styles.sectionHeader}>
          {t('m.fund.contributionDetailsHeader')}
        </AppText>

        <View style={styles.metaRow}>
          <AppText step="secondary" tone="muted">{t('m.fund.amountLabel')}</AppText>
          <AppText step="body">{amountFormatted}</AppText>
        </View>

        <View style={styles.metaRow}>
          <AppText step="secondary" tone="muted">{t('m.fund.bankReferenceLabel')}</AppText>
          <AppText step="body" mono>{contribution.bankReference}</AppText>
        </View>

        <View style={styles.metaRow}>
          <AppText step="secondary" tone="muted">{t('m.fund.transferDateLabel')}</AppText>
          <AppText step="body">{contribution.transferDate}</AppText>
        </View>

        <View style={styles.metaRow}>
          <AppText step="secondary" tone="muted">{t('m.fund.submittedAt')}</AppText>
          <AppText step="body">
            {contribution.createdAt ? formatDateTime(contribution.createdAt, language) : '—'}
          </AppText>
        </View>
      </SurfaceCard>

      {/* Timeline & Status History */}
      {contribution.timeline && contribution.timeline.length > 0 ? (
        <SurfaceCard style={styles.card}>
          <AppText step="card" style={styles.sectionHeader}>
            {t('m.fund.timelineHeader')}
          </AppText>

          {contribution.timeline.map((entry, index) => {
            const entryTone = STATUS_TONES[entry.status] || 'neutral';
            const desc = language === 'ta' ? entry.descriptionTa : entry.descriptionEn;
            return (
              <View key={`${entry.status}-${index}`} style={styles.timelineItem}>
                <View style={styles.timelineIndicator}>
                  <View style={[styles.timelineDot, { backgroundColor: getToneColor(entryTone) }]} />
                  {index < contribution.timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeaderRow}>
                    <StatusTag
                      tone={entryTone}
                      label={t(`m.fund.status${toPascalCase(entry.status)}` as any, entry.status)}
                    />
                    <AppText step="caption" tone="muted">
                      {formatDateTime(entry.occurredAt, language)}
                    </AppText>
                  </View>
                  {desc ? (
                    <AppText step="secondary" tone="secondary" style={styles.timelineNote}>
                      {desc}
                    </AppText>
                  ) : null}
                </View>
              </View>
            );
          })}
        </SurfaceCard>
      ) : null}

      <Button
        variant="secondary"
        onPress={() => router.replace({ pathname: '/fund' } as unknown as Href)}
        label={t('m.fund.newContribution')}
      />
    </View>
  );
}

function toPascalCase(str: string): string {
  return str
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function getToneColor(tone: Tone): string {
  switch (tone) {
    case 'verified':
      return colors.successText;
    case 'pending':
      return colors.warningText;
    case 'error':
      return colors.error;
    default:
      return colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  card: {
    gap: spacing[3],
  },
  verifiedCard: {
    borderColor: colors.successText,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptCodeText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.successText,
  },
  flex: {
    flex: 1,
  },
  sectionHeader: {
    fontWeight: '600',
  },
  monoRef: {
    fontSize: 22,
    marginTop: spacing[1],
  },
  amountText: {
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
    minHeight: control.touchMin,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.controlBorder,
    marginVertical: spacing[1],
  },
  timelineItem: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  timelineIndicator: {
    alignItems: 'center',
    width: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.controlBorder,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing[3],
    gap: spacing[1],
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineNote: {
    marginTop: spacing[1],
  },
});
