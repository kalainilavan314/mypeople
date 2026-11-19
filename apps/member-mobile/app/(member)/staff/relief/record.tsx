import type { Place, ReliefDistribution, ReliefItemKey, ReliefOverview } from '@my-people/api-client';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  Notice,
  Screen,
  SegmentedControl,
  SelectField,
  type SelectOption,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
  useMember,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { useAreaName } from '@/features/area/useAreaName';
import { encryptedOnDevice } from '@/features/staff/fieldVisits/secureChunks';
import {
  clearReliefDraft,
  EMPTY_DRAFT,
  localDay,
  readReliefDraft,
  saveReliefDraft,
  type ReliefDraft,
} from '@/features/staff/relief/reliefDraft';
import { reliefErrorMessage } from '@/features/staff/relief/reliefErrors';
import { api } from '@/lib/api';
import { useStaff } from '@/providers/StaffProvider';

const CASE_REF = /^AS-[A-Z2-7]{8}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * S16: relief handed out from a store, to an AS- case or a group at a site (never a name), with the
 * evidence. The quantity cannot exceed what the store holds. A person without a case is first recorded
 * through Community Support intake (S11). The form is kept encrypted on the phone until it is saved.
 */
export default function RecordReliefScreen() {
  const { t } = useTranslation();
  const { permissions } = useStaff();
  const overview = useApiQuery(async () => (permissions.has('relief.logistics') ? api().getReliefOverview() : null), [permissions]);
  return (
    <Screen edges={['bottom']} maxContentWidth={720}>
      {!permissions.has('relief.logistics') ? (
        <Notice tone="info">{t('s.relief.noAccess')}</Notice>
      ) : (
        <QueryView query={overview}>{(data) => (data ? <RecordForm overview={data} /> : null)}</QueryView>
      )}
    </Screen>
  );
}

function RecordForm({ overview }: { overview: ReliefOverview }) {
  const { t } = useTranslation();
  const member = useMember();
  const localized = useLocalized();
  const [draft, setDraft] = useState<ReliefDraft | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [recorded, setRecorded] = useState<ReliefDistribution | null>(null);

  useEffect(() => {
    let active = true;
    void readReliefDraft(member.id).then((saved) => active && setDraft(saved ?? EMPTY_DRAFT));
    return () => {
      active = false;
    };
  }, [member.id]);

  const change = (patch: Partial<ReliefDraft>) =>
    setDraft((current) => {
      const next = { ...(current ?? EMPTY_DRAFT), ...patch };
      void saveReliefDraft(member.id, next);
      return next;
    });

  const record = useApiAction(async (current: ReliefDraft) => {
    if (!current.storeKey || !current.item) return;
    const deliveredOn = current.day === 'today' ? localDay(0) : current.day === 'yesterday' ? localDay(1) : current.otherDate;
    const area = current.gn ? { level: 'gn' as const, code: current.gn } : areaOfStore(current.storeKey, current.ds);
    const saved = await api().recordReliefDistribution({
      storeKey: current.storeKey,
      area,
      item: current.item as ReliefItemKey,
      quantity: Number(current.quantity),
      recipientKind: current.recipientKind,
      caseRef: current.recipientKind === 'case' ? current.caseRef.trim().toUpperCase() : null,
      groupSite: current.recipientKind === 'group' ? current.groupSite.trim() : null,
      households: current.recipientKind === 'group' ? Number(current.households) : null,
      evidence: current.evidence.trim(),
      deliveredOn,
      alertId: null,
    });
    await clearReliefDraft(member.id);
    setDraft(EMPTY_DRAFT);
    setShowErrors(false);
    setRecorded(saved);
  });

  if (!draft) return null;

  const stores = [...new Set(overview.stock.filter((line) => line.balance > 0).map((line) => line.storeKey))];
  const lines = overview.stock.filter((line) => line.storeKey === draft.storeKey && line.balance > 0);
  const chosenLine = lines.find((line) => line.item === draft.item);
  const quantity = Number(draft.quantity);
  const problems = {
    store: !draft.storeKey,
    item: !chosenLine,
    quantity: !/^\d{1,7}$/.test(draft.quantity) || quantity < 1,
    tooMuch: Boolean(chosenLine) && quantity > (chosenLine?.balance ?? 0),
    caseRef: draft.recipientKind === 'case' && !CASE_REF.test(draft.caseRef.trim().toUpperCase()),
    site: draft.recipientKind === 'group' && draft.groupSite.trim().length < 3,
    households: draft.recipientKind === 'group' && (!/^\d{1,6}$/.test(draft.households) || Number(draft.households) < 1),
    evidence: draft.evidence.trim().length < 3,
    date: draft.day === 'earlier' && !DATE.test(draft.otherDate),
  };
  const submit = () => {
    if (Object.values(problems).some(Boolean)) {
      setShowErrors(true);
      return;
    }
    setRecorded(null);
    void record.run(draft);
  };
  const itemName = (key: string) => {
    const item = overview.items.find((candidate) => candidate.key === key);
    return item ? localized(item.nameEn, item.nameTa) : key;
  };

  if (stores.length === 0 && !recorded) {
    return <Notice tone="info">{t('s.relief.nothingToHandOut')}</Notice>;
  }

  return (
    <View style={styles.body}>
      {recorded ? (
        <Notice tone="success" title={t('s.relief.recordedTitle')}>
          {t('s.relief.recordedBody', { ref: recorded.distributionRef })}
        </Notice>
      ) : null}
      <AppText step="secondary" tone="secondary">
        {encryptedOnDevice ? t('s.relief.draftEncrypted') : t('s.relief.draftMemory')}
      </AppText>

      <SurfaceCard style={styles.card}>
        <StoreSelect
          stores={stores}
          value={draft.storeKey}
          onChange={(storeKey) => change({ storeKey, item: null, ds: null, gn: null })}
          error={showErrors && problems.store ? t('s.relief.storeError') : null}
        />
        <SelectField
          label={t('s.relief.item')}
          placeholder={t('s.relief.chooseItem')}
          value={draft.item}
          disabled={!draft.storeKey}
          options={lines.map((line) => ({
            value: line.item,
            label: `${itemName(line.item)} (${t('s.relief.balance', { balance: line.balance, unit: t(`s.relief.unit_${line.unit}`) })})`,
          }))}
          onChange={(item) => change({ item })}
          error={showErrors && problems.item ? t('s.relief.itemError') : null}
        />
        <TextField
          label={chosenLine ? t('s.relief.quantityIn', { unit: t(`s.relief.unit_${chosenLine.unit}`) }) : t('s.relief.quantity')}
          value={draft.quantity}
          keyboardType="number-pad"
          maxLength={7}
          onChangeText={(value) => change({ quantity: value })}
          error={
            showErrors && problems.quantity
              ? t('s.relief.quantityError')
              : problems.tooMuch
                ? t('s.relief.tooMuch', { balance: chosenLine?.balance ?? 0 })
                : null
          }
        />
      </SurfaceCard>

      {draft.storeKey ? (
        <SurfaceCard style={styles.card}>
          <AppText step="section" accessibilityRole="header">
            {t('s.relief.whereHeading')}
          </AppText>
          <DeliveryArea storeKey={draft.storeKey} ds={draft.ds} gn={draft.gn} onChange={(ds, gn) => change({ ds, gn })} />
        </SurfaceCard>
      ) : null}

      <SurfaceCard style={styles.card}>
        <AppText step="section" accessibilityRole="header">
          {t('s.relief.recipientHeading')}
        </AppText>
        <SegmentedControl
          label={t('s.relief.recipientHeading')}
          selected={draft.recipientKind}
          onSelect={(recipientKind) => change({ recipientKind })}
          options={[
            { key: 'group', label: t('s.relief.recipientGroup') },
            { key: 'case', label: t('s.relief.recipientCase') },
          ]}
        />
        {draft.recipientKind === 'case' ? (
          <>
            <TextField
              label={t('s.relief.caseRef')}
              hint={t('s.relief.caseRefHint')}
              value={draft.caseRef}
              autoCapitalize="characters"
              maxLength={11}
              onChangeText={(value) => change({ caseRef: value })}
              error={showErrors && problems.caseRef ? t('s.relief.caseRefError') : null}
            />
            <AppText step="secondary" tone="muted">
              {t('s.relief.noCaseYet')}
            </AppText>
          </>
        ) : (
          <>
            <TextField
              label={t('s.relief.site')}
              hint={t('s.relief.siteHint')}
              value={draft.groupSite}
              maxLength={200}
              onChangeText={(value) => change({ groupSite: value })}
              error={showErrors && problems.site ? t('s.relief.siteError') : null}
            />
            <TextField
              label={t('s.relief.households')}
              value={draft.households}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => change({ households: value })}
              error={showErrors && problems.households ? t('s.relief.householdsError') : null}
            />
          </>
        )}
        <AppText step="caption" tone="muted">
          {t('s.relief.noNames')}
        </AppText>
      </SurfaceCard>

      <SurfaceCard style={styles.card}>
        <TextField
          label={t('s.relief.evidence')}
          hint={t('s.relief.evidenceHint')}
          value={draft.evidence}
          maxLength={500}
          onChangeText={(value) => change({ evidence: value })}
          error={showErrors && problems.evidence ? t('s.relief.evidenceError') : null}
        />
        <AppText step="label">{t('s.relief.when')}</AppText>
        <ChipRow
          label={t('s.relief.when')}
          selected={draft.day}
          onSelect={(day) => change({ day })}
          options={[
            { key: 'today', label: t('s.relief.today') },
            { key: 'yesterday', label: t('s.relief.yesterday') },
            { key: 'earlier', label: t('s.relief.earlier') },
          ]}
        />
        {draft.day === 'earlier' ? (
          <TextField
            label={t('s.relief.otherDate')}
            hint={t('s.relief.otherDateHint')}
            value={draft.otherDate}
            maxLength={10}
            onChangeText={(value) => change({ otherDate: value })}
            error={showErrors && problems.date ? t('s.relief.dateError') : null}
          />
        ) : null}
        {record.error ? <Notice tone="error">{reliefErrorMessage(t, record.error)}</Notice> : null}
        <Button label={t('s.relief.save')} busy={record.busy} busyLabel={t('s.common.saving')} onPress={submit} />
        <Button label={t('s.relief.backToStock')} variant="quiet" onPress={() => router.back()} />
      </SurfaceCard>
    </View>
  );
}

/** The store's own area when no GN division was chosen: its DS division, or the DS chosen in a district. */
function areaOfStore(storeKey: string, ds: string | null): { level: 'district' | 'ds'; code: string } {
  if (ds) return { level: 'ds', code: ds };
  const [level, code] = storeKey.split(':', 2);
  return { level: level === 'district' ? 'district' : 'ds', code: code ?? '' };
}

function StoreSelect({
  stores,
  value,
  onChange,
  error,
}: {
  stores: string[];
  value: string | null;
  onChange: (store: string) => void;
  error: string | null;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const names = useApiQuery(async () => (stores.length ? api().listAreaNames(stores) : []), [stores.join(',')]);
  const label = (key: string) => {
    const found = names.data?.find((name) => name.key === key);
    return found ? ((language === 'ta' ? found.nameTa : found.nameEn) ?? found.nameEn ?? key) : key;
  };
  return (
    <SelectField
      label={t('s.relief.storeLabel')}
      placeholder={t('s.relief.chooseStore')}
      value={value}
      options={stores.map((key) => ({ value: key, label: label(key) }))}
      onChange={onChange}
      error={error}
    />
  );
}

function placeOptions(places: Place[] | undefined, language: string): SelectOption[] {
  return (places ?? []).map((place) => ({
    value: place.code,
    label: (language === 'ta' ? place.nameTa : place.nameEn) ?? place.nameEn ?? place.code,
  }));
}

/** Where it was handed out, inside the store's area: a DS division (for a district store) and a GN division. */
function DeliveryArea({
  storeKey,
  ds,
  gn,
  onChange,
}: {
  storeKey: string;
  ds: string | null;
  gn: string | null;
  onChange: (ds: string | null, gn: string | null) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [level, code] = storeKey.split(':', 2);
  const storeName = useAreaName(storeKey);
  const divisions = useApiQuery(async () => (level === 'district' && code ? api().listDsDivisions(code) : []), [storeKey]);
  const dsCode = level === 'ds' ? (code ?? null) : ds;
  const gnDivisions = useApiQuery(async () => (dsCode ? api().listGnDivisions(dsCode) : []), [dsCode]);
  return (
    <View style={styles.group}>
      {level === 'district' ? (
        <SelectField
          label={t('s.relief.dsLabel')}
          placeholder={t('s.relief.wholeArea', { area: storeName ?? storeKey })}
          value={ds ?? ''}
          options={[
            { value: '', label: t('s.relief.wholeArea', { area: storeName ?? storeKey }) },
            ...placeOptions(divisions.data, language),
          ]}
          onChange={(value) => onChange(value || null, null)}
        />
      ) : null}
      <SelectField
        label={t('s.relief.gnLabel')}
        placeholder={t('s.relief.wholeDivision')}
        value={gn ?? ''}
        disabled={!dsCode}
        options={[{ value: '', label: t('s.relief.wholeDivision') }, ...placeOptions(gnDivisions.data, language)]}
        onChange={(value) => onChange(level === 'district' ? ds : null, value || null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing[3] },
  card: { gap: spacing[3] },
  group: { gap: spacing[3] },
});
