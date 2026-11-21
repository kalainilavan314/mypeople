import Ionicons from '@expo/vector-icons/Ionicons';
import type { FundConfig } from '@my-people/api-client';
import * as Crypto from 'expo-crypto';
import { type Href, router } from 'expo-router';
import { useEffect, useRef, useState, type ElementRef } from 'react';
import { BackHandler, Clipboard, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Checkbox,
  confirmAction,
  Notice,
  showMessage,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { BankCard } from '@/features/fund/BankCard';
import { fundColors, fundStyles } from '@/features/fund/fundStyle';
import { MethodTile } from '@/features/fund/MethodTile';
import { PillButton } from '@/features/fund/PillButton';
import { pickImage, type PickedImage } from '@/features/identity/pickImage';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const MIN_LKR = 100;
const MAX_LKR = 1_000_000;
const STEP_LKR = 500;

type Step = 1 | 2 | 3;
type Method = 'online' | 'branch';

const formatLkr = (amount: number) => `LKR ${amount.toLocaleString('en-US')}`;

/**
 * H17, the party fund contribution, in the payment design the owner chose on 18 November 2026: the
 * contribution, then how to pay (TMK's official bank account), then the transfer details and the
 * slip. Contributions are bank transfers only: the member pays the account from their own bank and
 * the finance team checks the slip against the bank statement before any receipt (FR-FUND-001 to 011).
 */
export default function FundScreen() {
  const { t } = useTranslation();
  const configQuery = useApiQuery(() => api().getFundConfig());

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.page}>
      <QueryView query={configQuery}>
        {(config) =>
          config.intakeAvailable ? (
            <FundFlow config={config} />
          ) : (
            <>
              <FundHeader title={t('m.fund.title')} onBack={() => router.back()} />
              <View style={styles.content}>
                <Notice tone="info" title={t('m.fund.unavailable')}>
                  {t('m.fund.unavailableDesc')}
                </Notice>
              </View>
            </>
          )
        }
      </QueryView>
    </SafeAreaView>
  );
}

/** The design's own top bar: a back arrow and a centred title. */
function FundHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('m.common.back')} hitSlop={8} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color={fundColors.ink} />
      </Pressable>
      <AppText step="card" accessibilityRole="header" style={styles.headerTitle} numberOfLines={1}>
        {title}
      </AppText>
      <View style={styles.backButton} />
    </View>
  );
}

function FundFlow({ config }: { config: FundConfig }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const today = new Date().toISOString().slice(0, 10);
  const presets = config.amountPresets.map((minor) => Math.round(minor / 100));

  const [step, setStep] = useState<Step>(1);
  const [amount, setAmount] = useState<number>(presets[2] ?? 2500);
  const [otherAmountText, setOtherAmountText] = useState('');
  const [method, setMethod] = useState<Method>('online');
  const [transferDate, setTransferDate] = useState(today);
  const [bankReference, setBankReference] = useState('');
  const [slip, setSlip] = useState<PickedImage | null>(null);
  const [noPrivilege, setNoPrivilege] = useState(false);
  const [accurateInfo, setAccurateInfo] = useState(false);
  const [payingForSelf, setPayingForSelf] = useState(true);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const submissionIntent = useRef<{ fingerprint: string; key: string } | null>(null);
  const scroll = useRef<ElementRef<typeof ScrollView>>(null);

  const goTo = (next: Step) => {
    setValidationError(null);
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const back = () => (step > 1 ? goTo((step - 1) as Step) : router.back());

  // Android's back button steps back through the flow before it leaves the screen.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 1) return false;
      goTo((step - 1) as Step);
      return true;
    });
    return () => subscription.remove();
  });

  const amountValid = Number.isInteger(amount) && amount >= MIN_LKR && amount <= MAX_LKR;

  const applyOtherAmount = () => {
    const value = parseInt(otherAmountText.replace(/[^\d]/g, ''), 10);
    if (Number.isNaN(value) || value < MIN_LKR || value > MAX_LKR) {
      setValidationError(t('m.fund.errors.invalidAmount'));
      return;
    }
    setValidationError(null);
    setAmount(value);
  };

  const continueToPayment = () => {
    if (!amountValid) {
      setValidationError(t('m.fund.errors.amountRequired'));
      return;
    }
    goTo(2);
  };

  const copyAccountNumber = () => {
    Clipboard.setString(config.accountNumber ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const pickSlip = async (source: 'library' | 'camera') => {
    setValidationError(null);
    let result: Awaited<ReturnType<typeof pickImage>>;
    try {
      result = await pickImage(source);
    } catch (error) {
      setValidationError(errorMessage(t, error));
      return;
    }
    if ('denied' in result) {
      showMessage(t('m.common.loadFailed'), t('m.verify.cameraDenied'));
      return;
    }
    if ('cancelled' in result) return;
    if (result.image.byteSize > 15 * 1024 * 1024) {
      setValidationError(t('m.errors.too_large'));
      return;
    }
    setSlip(result.image);
  };

  const submitAction = useApiAction(async () => {
    setValidationError(null);
    if (!amountValid) {
      setValidationError(t('m.fund.errors.amountRequired'));
      return;
    }
    const parsedTransferDate = /^\d{4}-\d{2}-\d{2}$/.test(transferDate) ? new Date(`${transferDate}T00:00:00Z`) : null;
    if (!parsedTransferDate || Number.isNaN(parsedTransferDate.getTime()) || parsedTransferDate.toISOString().slice(0, 10) !== transferDate) {
      setValidationError(t('m.fund.errors.dateRequired'));
      return;
    }
    if (transferDate > today) {
      setValidationError(t('m.fund.errors.futureDateNotAllowed'));
      return;
    }
    const earliest = new Date();
    earliest.setUTCDate(earliest.getUTCDate() - 90);
    if (transferDate < earliest.toISOString().slice(0, 10)) {
      setValidationError(t('m.fund.errors.dateTooOld'));
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

    const confirmed = await confirmAction({
      title: t('m.fund.confirmTitle'),
      message: t('m.fund.confirmBody', { amount: amount.toLocaleString('en-US'), reference: bankReference.trim() }),
      confirmLabel: t('m.fund.confirmYes'),
      cancelLabel: t('m.fund.confirmCancel'),
    });
    if (!confirmed) return;

    // The same details reuse the same idempotency key, so a retried submission cannot create a second draft.
    const amountMinor = amount * 100;
    const fingerprint = JSON.stringify({ amountMinor, transferDate, bankReference: bankReference.trim(), noPrivilege, accurateInfo, payingForSelf });
    if (submissionIntent.current?.fingerprint !== fingerprint) {
      submissionIntent.current = { fingerprint, key: Crypto.randomUUID() };
    }
    const draft = await api().createContribution(
      {
        amountMinor,
        transferDate,
        bankReference: bankReference.trim(),
        noPrivilegeAcknowledged: noPrivilege,
        informationAccurateAcknowledged: accurateInfo,
        payingForSelf,
      },
      submissionIntent.current.key,
    );
    await api().uploadContributionSlip(draft.id, slip.body, slip.contentType);
    await api().submitContribution(draft.id);
    router.replace({ pathname: '/fund/receipt/[id]', params: { id: draft.id } } as unknown as Href);
  });

  const titles: Record<Step, string> = {
    1: t('m.fund.stepContribution'),
    2: t('m.fund.stepPayment'),
    3: t('m.fund.stepDetails'),
  };
  const instructions = language === 'ta' ? config.transferInstructionsTa : config.transferInstructionsEn;

  return (
    <>
      <FundHeader title={titles[step]} onBack={back} />
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            {/* The contribution, as the item in the design's bag. */}
            <View style={[fundStyles.box, styles.item]}>
              <View style={styles.thumb}>
                <Image source={require('../../../assets/brand/logo.png')} style={styles.thumbImage} resizeMode="contain" accessible={false} />
              </View>
              <View style={styles.itemText}>
                <AppText step="card">{t('m.fund.itemTitle')}</AppText>
                <AppText step="caption" style={styles.muted}>
                  {t('m.fund.itemSubtitle')}
                </AppText>
                <AppText step="section" style={styles.ink}>
                  {formatLkr(amount)}
                </AppText>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setAmount((value) => Math.max(MIN_LKR, value - STEP_LKR))}
                  disabled={amount - STEP_LKR < MIN_LKR}
                  accessibilityRole="button"
                  accessibilityLabel={t('m.fund.lessAmount', { step: STEP_LKR })}
                  style={styles.stepTarget}>
                  <View style={[styles.stepButton, styles.stepMinus, amount - STEP_LKR < MIN_LKR && styles.stepDisabled]}>
                    <Ionicons name="remove" size={16} color={fundColors.ink} />
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => setAmount((value) => Math.min(MAX_LKR, value + STEP_LKR))}
                  disabled={amount + STEP_LKR > MAX_LKR}
                  accessibilityRole="button"
                  accessibilityLabel={t('m.fund.moreAmount', { step: STEP_LKR })}
                  style={styles.stepTarget}>
                  <View style={[styles.stepButton, styles.stepPlus]}>
                    <Ionicons name="add" size={16} color={fundColors.onInk} />
                  </View>
                </Pressable>
              </View>
            </View>

            <View style={styles.presets} accessibilityRole="radiogroup" accessibilityLabel={t('m.fund.amountLabel')}>
              {presets.map((preset) => {
                const chosen = preset === amount;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => {
                      setValidationError(null);
                      setAmount(preset);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: chosen }}
                    style={[styles.preset, chosen && styles.presetChosen]}>
                    <AppText step="label" style={chosen ? styles.onInk : styles.ink}>
                      {preset.toLocaleString('en-US')}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {/* "Other amount" with Apply, as the design's promo code field. */}
            <View style={styles.applyRow}>
              <View style={styles.otherAmountInput}>
                <TextField
                  label={t('m.fund.otherAmount')}
                  value={otherAmountText}
                  onChangeText={setOtherAmountText}
                  keyboardType="number-pad"
                  placeholder={t('m.fund.customAmountPlaceholder')}
                  returnKeyType="done"
                  onSubmitEditing={applyOtherAmount}
                />
              </View>
              <Pressable onPress={applyOtherAmount} accessibilityRole="button" style={({ pressed }) => [styles.applyButton, pressed && styles.applyPressed]}>
                <AppText step="label" style={styles.onInk}>
                  {t('m.fund.apply')}
                </AppText>
              </Pressable>
            </View>

            <View style={styles.summary}>
              <SummaryRow label={t('m.fund.summaryContribution')} value={formatLkr(amount)} />
              <SummaryRow label={t('m.fund.summaryMethod')} value={t('m.fund.cardLabel')} />
              <SummaryRow label={t('m.fund.summaryTotal')} value={formatLkr(amount)} strong last />
            </View>
            <AppText step="caption" style={styles.muted}>
              {t('m.fund.declarationsNotice')}
            </AppText>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <AppText step="card">{t('m.fund.payTo')}</AppText>
            <View style={styles.payTo}>
              <View style={[fundStyles.box, styles.payToThumb]}>
                <Image source={require('../../../assets/brand/logo.png')} style={styles.payToImage} resizeMode="contain" accessible={false} />
              </View>
              <View style={styles.flex}>
                <AppText step="card">{t('m.fund.itemTitle')}</AppText>
                <AppText step="secondary" style={styles.muted}>
                  {[config.bankName, config.branchName].filter(Boolean).join(' · ')}
                </AppText>
              </View>
            </View>

            <AppText step="card">{t('m.fund.paymentMethod')}</AppText>
            <View style={styles.tiles} accessibilityRole="radiogroup" accessibilityLabel={t('m.fund.paymentMethod')}>
              <MethodTile icon="phone-portrait-outline" label={t('m.fund.methodOnline')} selected={method === 'online'} onPress={() => setMethod('online')} />
              <MethodTile icon="business-outline" label={t('m.fund.methodBranch')} selected={method === 'branch'} onPress={() => setMethod('branch')} />
            </View>
            <AppText step="secondary" style={styles.muted}>
              {method === 'online' ? t('m.fund.methodOnlineHint') : t('m.fund.methodBranchHint')}
            </AppText>

            <BankCard
              bankName={config.bankName ?? ''}
              accountName={config.accountName ?? ''}
              accountNumber={config.accountNumber ?? ''}
              onCopy={copyAccountNumber}
              copied={copied}
            />
            <AppText step="caption" style={[styles.muted, styles.center]} accessibilityLiveRegion="polite">
              {copied ? t('m.fund.accountCopied') : t('m.fund.tapToCopy')}
            </AppText>
            {config.branchName ? <SummaryRow label={t('m.fund.branch')} value={config.branchName} /> : null}
            {instructions ? (
              <AppText step="secondary" style={styles.muted}>
                {instructions}
              </AppText>
            ) : null}

            <View style={styles.totalRow}>
              <AppText step="card">{t('m.fund.totalPayment')}</AppText>
              <AppText step="section" style={styles.ink}>
                {formatLkr(amount)}
              </AppText>
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={styles.pair}>
              <View style={styles.flex}>
                <TextField
                  label={t('m.fund.transferDateLabel')}
                  value={transferDate}
                  onChangeText={(text) => {
                    setTransferDate(text);
                    setValidationError(null);
                  }}
                  placeholder={t('m.fund.transferDatePlaceholder')}
                />
              </View>
              <View style={styles.flex}>
                <TextField label={t('m.fund.amountShort')} value={formatLkr(amount)} editable={false} />
              </View>
            </View>

            <TextField
              label={t('m.fund.bankReferenceLabel')}
              hint={t('m.fund.bankReferenceHelp')}
              value={bankReference}
              onChangeText={(text) => {
                setBankReference(text);
                setValidationError(null);
              }}
              placeholder={t('m.fund.bankReferencePlaceholder')}
              autoCapitalize="characters"
            />

            <View style={styles.slipBlock}>
              <AppText step="secondary" style={styles.muted}>
                {t('m.fund.slipHeader')}
              </AppText>
              {slip ? (
                <View style={[fundStyles.box, styles.slipPreviewBox]}>
                  <Image source={{ uri: slip.previewUri }} style={styles.slipPreview} resizeMode="contain" accessibilityLabel={t('m.fund.slipAttached')} />
                </View>
              ) : null}
              <View style={styles.tiles}>
                <MethodTile icon="camera-outline" label={t('m.fund.slipCamera')} selected={false} accessibilityRole="button" onPress={() => void pickSlip('camera')} />
                <MethodTile icon="images-outline" label={slip ? t('m.fund.changeSlip') : t('m.fund.slipPhotos')} selected={false} accessibilityRole="button" onPress={() => void pickSlip('library')} />
              </View>
              <AppText step="caption" style={styles.muted}>
                {t('m.fund.slipHelp')}
              </AppText>
            </View>

            <View style={[fundStyles.box, styles.declarations]}>
              <Checkbox label={t('m.fund.noPrivilegeLabel')} checked={noPrivilege} onChange={setNoPrivilege} />
              <Checkbox label={t('m.fund.accurateInfoLabel')} checked={accurateInfo} onChange={setAccurateInfo} />
              <Checkbox label={t('m.fund.payingForSelfLabel')} checked={payingForSelf} onChange={setPayingForSelf} />
            </View>
          </>
        ) : null}

        {validationError ? <Notice tone="error">{validationError}</Notice> : null}
        {submitAction.error ? <Notice tone="error">{errorMessage(t, submitAction.error)}</Notice> : null}

        {step === 1 ? <PillButton label={t('m.fund.continueToPayment')} onPress={continueToPayment} /> : null}
        {step === 2 ? <PillButton label={t('m.fund.madeTransfer')} onPress={() => goTo(3)} /> : null}
        {step === 3 ? (
          <PillButton
            label={submitAction.busy ? t('m.fund.submitting') : t('m.fund.submitButton')}
            busy={submitAction.busy}
            onPress={() => void submitAction.run()}
          />
        ) : null}
      </ScrollView>
    </>
  );
}

function SummaryRow({ label, value, strong = false, last = false }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryDivider]}>
      <AppText step={strong ? 'card' : 'secondary'} style={strong ? styles.ink : styles.muted}>
        {label}
      </AppText>
      <AppText step={strong ? 'section' : 'card'} style={styles.ink}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: fundColors.page },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: fundColors.ink },
  content: { padding: 20, paddingTop: 8, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  flex: { flex: 1 },
  ink: { color: fundColors.ink },
  onInk: { color: fundColors.onInk },
  muted: { color: fundColors.muted },
  center: { textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: 50, height: 50 },
  itemText: { flex: 1, gap: 2 },
  // 32 px circles as designed, each inside a 44 px touch target.
  stepper: { gap: 0, alignItems: 'center' },
  stepTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepMinus: { borderWidth: 1.5, borderColor: fundColors.ink },
  stepPlus: { backgroundColor: fundColors.ink },
  stepDisabled: { opacity: 0.3 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: fundColors.box,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChosen: { backgroundColor: fundColors.ink },
  applyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  // The field gives way so the Apply button always fits, whatever the language.
  otherAmountInput: { flex: 1, minWidth: 0 },
  applyButton: { flexShrink: 0, minHeight: 50, paddingHorizontal: 22, borderRadius: 25, backgroundColor: fundColors.ink, alignItems: 'center', justifyContent: 'center' },
  applyPressed: { backgroundColor: fundColors.inkSoft },
  summary: { marginTop: 4 },
  summaryRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fundColors.line },
  payTo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  payToThumb: { width: 64, height: 64, padding: 8, alignItems: 'center', justifyContent: 'center' },
  payToImage: { width: 46, height: 46 },
  tiles: { flexDirection: 'row', gap: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  pair: { flexDirection: 'row', gap: 12 },
  slipBlock: { gap: 10 },
  slipPreviewBox: { padding: 8 },
  slipPreview: { width: '100%', height: 180, borderRadius: 10 },
  declarations: { gap: 12 },
});
