import { useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';

import { colors, control, radius, spacing } from '@my-people/design-tokens';
import {
  AppText,
  Button,
  Checkbox,
  ChipRow,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { pickImage, type PickedImage } from '@/features/identity/pickImage';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const AMOUNT_PRESETS = [
  { key: '500', label: '500 LKR' },
  { key: '1000', label: '1,000 LKR' },
  { key: '2500', label: '2,500 LKR' },
  { key: '5000', label: '5,000 LKR' },
  { key: 'custom', label: 'Custom' },
] as const;

export default function FundScreen() {
  const { t } = useTranslation();
  const configQuery = useApiQuery(() => api().getFundConfig());

  return (
    <Screen title={t('m.fund.title')} subtitle={t('m.fund.subtitle')}>
      <QueryView query={configQuery}>
        {(config) =>
          config.intakeAvailable ? (
            <FundIntakeForm config={config} />
          ) : (
            <Notice tone="info" title={t('m.fund.unavailable')}>
              {t('m.fund.unavailableDesc')}
            </Notice>
          )
        }
      </QueryView>
    </Screen>
  );
}

function FundIntakeForm({ config }: { config: Awaited<ReturnType<ReturnType<typeof api>['getFundConfig']>> }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const today = new Date().toISOString().slice(0, 10);

  const [selectedPreset, setSelectedPreset] = useState<string>('2500');
  const [customAmountText, setCustomAmountText] = useState('');
  const [transferDate, setTransferDate] = useState(today);
  const [bankReference, setBankReference] = useState('');
  const [slip, setSlip] = useState<{ image: PickedImage; previewUri?: string } | null>(null);

  const [noPrivilege, setNoPrivilege] = useState(false);
  const [accurateInfo, setAccurateInfo] = useState(false);
  const [payingForSelf, setPayingForSelf] = useState(true);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const submissionIntent = useRef<{ fingerprint: string; key: string } | null>(null);

  const effectiveAmountLkr =
    selectedPreset === 'custom' ? parseInt(customAmountText.trim(), 10) : parseInt(selectedPreset, 10);

  const copyToClipboard = (label: string, value: string) => {
    Clipboard.setString(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handlePickSlip = async (source: 'library' | 'camera') => {
    setValidationError(null);
    let result: Awaited<ReturnType<typeof pickImage>>;
    try {
      result = await pickImage(source);
    } catch (error) {
      setValidationError(errorMessage(t, error));
      return;
    }
    if ('denied' in result) {
      Alert.alert(t('m.common.loadFailed'), t('m.verify.cameraRefused'));
      return;
    }
    if ('cancelled' in result) return;

    if (result.image.byteSize > 15 * 1024 * 1024) {
      setValidationError(t('m.errors.too_large'));
      return;
    }

    setSlip({
      image: result.image,
      previewUri: result.image.previewUri,
    });
  };

  const submitAction = useApiAction(async () => {
    setValidationError(null);

    if (isNaN(effectiveAmountLkr) || effectiveAmountLkr < 100 || effectiveAmountLkr > 1000000) {
      setValidationError(t('m.fund.errors.amountRequired'));
      return;
    }

    if (!transferDate || transferDate.length !== 10) {
      setValidationError(t('m.fund.errors.dateRequired'));
      return;
    }

    if (transferDate > today) {
      setValidationError(t('m.fund.errors.futureDateNotAllowed'));
      return;
    }

    if (!bankReference.trim() || bankReference.trim().length < 4) {
      setValidationError(t('m.fund.errors.bankRefRequired'));
      return;
    }

    if (!slip) {
      setValidationError(t('m.fund.errors.slipRequired'));
      return;
    }

    if (!noPrivilege || !accurateInfo) {
      setValidationError(t('m.fund.errors.declarationsRequired'));
      return;
    }

    // Confirmation dialog before final submission
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('m.fund.confirmTitle'),
        t('m.fund.confirmBody', {
          amount: effectiveAmountLkr.toLocaleString(),
          reference: bankReference.trim(),
        }),
        [
          { text: t('m.fund.confirmCancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('m.fund.confirmYes'), style: 'default', onPress: () => resolve(true) },
        ],
      );
    });

    if (!confirmed) return;

    // Step 1: Create draft
    const amountMinor = effectiveAmountLkr * 100;
    const fingerprint = JSON.stringify({
      amountMinor,
      transferDate,
      bankReference: bankReference.trim(),
      noPrivilege,
      accurateInfo,
      payingForSelf,
    });
    if (submissionIntent.current?.fingerprint !== fingerprint) {
      submissionIntent.current = { fingerprint, key: Crypto.randomUUID() };
    }
    const draft = await api().createContribution({
      amountMinor,
      transferDate,
      bankReference: bankReference.trim(),
      noPrivilegeAcknowledged: noPrivilege,
      informationAccurateAcknowledged: accurateInfo,
      payingForSelf,
    }, submissionIntent.current.key);

    // Step 2: Upload encrypted slip
    await api().uploadContributionSlip(draft.id, slip.image.body, slip.image.contentType);

    // Step 3: Submit for staff review
    await api().submitContribution(draft.id);

    // Navigate to H18
    router.replace({ pathname: '/fund/receipt/[id]', params: { id: draft.id } } as unknown as Href);
  });

  const instructions = language === 'ta' ? config.transferInstructionsTa : config.transferInstructionsEn;

  return (
    <View style={styles.container}>
      {/* Official Bank Details Card */}
      <SurfaceCard style={styles.card}>
        <AppText step="card" style={styles.cardHeader}>
          {t('m.fund.bankDetailsHeader')}
        </AppText>

        {instructions ? (
          <AppText step="secondary" tone="muted">
            {instructions}
          </AppText>
        ) : null}

        <BankDetailRow
          label={t('m.fund.bankName')}
          value={config.bankName ?? ''}
          onCopy={() => copyToClipboard('bankName', config.bankName ?? '')}
          copied={copiedField === 'bankName'}
        />
        <BankDetailRow
          label={t('m.fund.accountName')}
          value={config.accountName ?? ''}
          onCopy={() => copyToClipboard('accountName', config.accountName ?? '')}
          copied={copiedField === 'accountName'}
        />
        <BankDetailRow
          label={t('m.fund.accountNumber')}
          value={config.accountNumber ?? ''}
          onCopy={() => copyToClipboard('accountNumber', config.accountNumber ?? '')}
          copied={copiedField === 'accountNumber'}
          mono
        />
        <BankDetailRow
          label={t('m.fund.branch')}
          value={config.branchName ?? ''}
          onCopy={() => copyToClipboard('branch', config.branchName ?? '')}
          copied={copiedField === 'branch'}
        />
      </SurfaceCard>

      {/* Contribution Details Card */}
      <SurfaceCard style={styles.card}>
        <AppText step="card" style={styles.cardHeader}>
          {t('m.fund.contributionDetailsHeader')}
        </AppText>

        <AppText step="label" style={styles.fieldLabel}>
          {t('m.fund.amountLabel')}
        </AppText>
        <ChipRow
          label={t('m.fund.amountLabel')}
          options={AMOUNT_PRESETS}
          selected={selectedPreset}
          onSelect={(key) => {
            setSelectedPreset(key);
            setValidationError(null);
          }}
        />

        {selectedPreset === 'custom' ? (
          <View style={styles.customAmountWrap}>
            <TextField
              label={t('m.fund.customAmount')}
              keyboardType="number-pad"
              value={customAmountText}
              onChangeText={(text) => {
                setCustomAmountText(text);
                setValidationError(null);
              }}
              placeholder="e.g. 1500"
            />
          </View>
        ) : null}

        <TextField
          label={t('m.fund.transferDateLabel')}
          value={transferDate}
          onChangeText={(text) => {
            setTransferDate(text);
            setValidationError(null);
          }}
          placeholder="YYYY-MM-DD"
        />

        <TextField
          label={t('m.fund.bankReferenceLabel')}
          hint={t('m.fund.bankReferenceHelp')}
          value={bankReference}
          onChangeText={(text) => {
            setBankReference(text);
            setValidationError(null);
          }}
          placeholder="e.g. TXN98765432"
          autoCapitalize="characters"
        />
      </SurfaceCard>

      {/* Slip Upload Card */}
      <SurfaceCard style={styles.card}>
        <AppText step="card" style={styles.cardHeader}>
          {t('m.fund.slipHeader')}
        </AppText>
        <AppText step="secondary" tone="muted">
          {t('m.fund.slipHelp')}
        </AppText>

        {slip ? (
          <View style={styles.slipPreviewContainer}>
            {slip.previewUri ? (
              <Image
                source={{ uri: slip.previewUri }}
                style={styles.slipPreview}
                resizeMode="contain"
                accessibilityLabel={t('m.fund.slipHeader')}
              />
            ) : (
              <View style={styles.slipPlaceholder}>
                <Ionicons name="document-attach" size={40} color={colors.primary} />
                <AppText step="body">Attached</AppText>
              </View>
            )}
            <Button
              variant="secondary"
              onPress={() => handlePickSlip('library')}
              label={t('m.fund.changeSlip')}
            />
          </View>
        ) : (
          <View style={styles.slipActions}>
            <Button
              variant="primary"
              onPress={() => handlePickSlip('library')}
              label={t('m.fund.chooseSlip')}
            />
          </View>
        )}
      </SurfaceCard>

      {/* Declarations Card */}
      <SurfaceCard style={styles.card}>
        <AppText step="card" style={styles.cardHeader}>
          {t('m.fund.declarationsHeader')}
        </AppText>

        <Notice tone="info">
          {t('m.fund.noPrivilegeLabel')}
        </Notice>

        <Checkbox
          label={t('m.fund.noPrivilegeLabel')}
          checked={noPrivilege}
          onChange={setNoPrivilege}
        />
        <Checkbox
          label={t('m.fund.accurateInfoLabel')}
          checked={accurateInfo}
          onChange={setAccurateInfo}
        />
        <Checkbox
          label={t('m.fund.payingForSelfLabel')}
          checked={payingForSelf}
          onChange={setPayingForSelf}
        />
      </SurfaceCard>

      {validationError ? (
        <Notice tone="error">
          {validationError}
        </Notice>
      ) : null}

      {submitAction.error ? (
        <Notice tone="error">
          {errorMessage(t, submitAction.error)}
        </Notice>
      ) : null}

      <Button
        variant="primary"
        busy={submitAction.busy}
        onPress={() => submitAction.run()}
        label={submitAction.busy ? t('m.fund.submitting') : t('m.fund.submitButton')}
      />
    </View>
  );
}

function BankDetailRow({
  label,
  value,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.detailRow}>
      <View style={styles.detailTextWrap}>
        <AppText step="secondary" tone="muted">{label}</AppText>
        <AppText step="body" mono={mono}>
          {value}
        </AppText>
      </View>
      <Pressable
        onPress={onCopy}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${t('m.fund.copy')} ${label}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.copyButton}>
        <Ionicons
          name={copied ? 'checkmark-circle' : 'copy-outline'}
          size={18}
          color={copied ? colors.successText : colors.primary}
        />
        <AppText step="caption" tone={copied ? 'success' : 'primary'}>
          {copied ? t('m.fund.copied') : t('m.fund.copy')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  card: {
    gap: spacing[3],
  },
  cardHeader: {
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.controlBorder,
    minHeight: control.touchMin,
  },
  detailTextWrap: {
    flex: 1,
    paddingRight: spacing[2],
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    minHeight: control.touchMin,
    minWidth: control.touchMin,
    justifyContent: 'center',
  },
  fieldLabel: {
    marginTop: spacing[1],
  },
  customAmountWrap: {
    marginTop: spacing[2],
  },
  slipActions: {
    marginTop: spacing[2],
  },
  slipPreviewContainer: {
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  slipPreview: {
    width: '100%',
    height: 180,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceVariant,
  },
  slipPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[1],
  },
});
