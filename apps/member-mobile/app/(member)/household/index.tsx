import type { Household, HouseholdMember } from '@my-people/api-client';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  confirmAction,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
  useLocalized,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import {
  adultsOf,
  canManageChild,
  childrenOf,
  placeLine,
  relationshipLabel,
} from '@/features/household/labels';
import { MyDetailsCard } from '@/features/household/MyDetailsCard';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type AdultRel = 'spouse' | 'parent' | 'sibling' | 'other';
const ADULT_RELATIONSHIPS: readonly AdultRel[] = ['spouse', 'parent', 'sibling', 'other'];

/**
 * Screen M06: My Household / எனது குடும்பம் (MP-FEA-002 §4.1).
 * One household per verified member, with its household ID and District, DS and GN; its adults
 * (each confirmed their own entry) and children (guardian-managed minimum records, OD-31).
 * Strictly voluntary (BR-098); anyone can leave at any time.
 */
export default function HouseholdScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const householdQuery = useApiQuery(() => api().getMyHousehold());
  const invitationsQuery = useApiQuery(() => api().getMyInvitations());
  const reload = () => {
    void householdQuery.reload();
    void invitationsQuery.reload();
  };

  return (
    <Screen
      edges={['bottom']}
      maxContentWidth={720}
      onRefresh={reload}
      refreshing={
        (householdQuery.loading && householdQuery.data !== undefined) ||
        (invitationsQuery.loading && invitationsQuery.data !== undefined)
      }>
      {/* Voluntary banner (BR-098) */}
      <SurfaceCard accent style={styles.voluntaryBanner}>
        <AppText step="caption" style={styles.voluntaryTag}>
          {t('m.household.voluntaryNotice')}
        </AppText>
        <AppText step="body" style={styles.voluntaryDetail}>
          {t('m.household.voluntaryNoticeDetail')}
        </AppText>
        <View style={styles.topMargin}>
          <Button
            label={t('m.household.privacyConsent')}
            variant="secondary"
            onPress={() => router.push('/(member)/household/privacy' as any)}
          />
        </View>
      </SurfaceCard>

      <QueryView query={householdQuery}>
        {(household) =>
          household ? (
            <ActiveHouseholdView household={household} onReload={reload} />
          ) : (
            <NoHouseholdView onCreated={reload} invitationsCount={invitationsQuery.data?.received.length ?? 0} />
          )
        }
      </QueryView>
    </Screen>
  );
}

function NoHouseholdView({ onCreated, invitationsCount }: { onCreated: () => void; invitationsCount: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const create = useApiAction(async () => {
    await api().createHousehold({ name: name.trim() || null });
    setShowForm(false);
    onCreated();
  });

  return (
    <View style={styles.sectionContainer}>
      {invitationsCount > 0 && (
        <SurfaceCard style={styles.inviteNotice}>
          <AppText step="section" style={styles.inviteNoticeTitle}>
            {t('m.household.pendingInvitations')} ({invitationsCount})
          </AppText>
          <AppText step="body" style={styles.mutedText}>
            {t('m.household.receivedInvitations')}
          </AppText>
          <View style={styles.topMargin}>
            <Button
              label={t('m.household.pendingInvitations')}
              variant="secondary"
              onPress={() => router.push('/(member)/household/invitations' as any)}
            />
          </View>
        </SurfaceCard>
      )}

      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('m.household.createTitle')}
        </AppText>
        <AppText step="body" style={styles.description}>
          {t('m.household.createDescription')}
        </AppText>

        {!showForm ? (
          <View style={styles.topMargin}>
            <Button label={t('m.household.createButton')} onPress={() => setShowForm(true)} />
          </View>
        ) : (
          <View style={styles.topMargin}>
            <TextField
              label={t('m.household.householdName')}
              value={name}
              onChangeText={setName}
              placeholder={t('m.household.householdNamePlaceholder')}
              maxLength={100}
              autoFocus
            />
            {create.error ? (
              <View style={styles.topMargin}>
                <Notice tone="error">{errorMessage(t, create.error)}</Notice>
              </View>
            ) : null}
            <View style={styles.formActions}>
              <Button label={t('m.household.createButton')} busy={create.busy} onPress={() => void create.run()} />
              <Button label={t('m.common.cancel')} variant="quiet" onPress={() => setShowForm(false)} />
            </View>
          </View>
        )}
      </SurfaceCard>
    </View>
  );
}

function ActiveHouseholdView({ household, onReload }: { household: Household; onReload: () => void }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const router = useRouter();
  const adults = adultsOf(household);
  const children = childrenOf(household);
  const me = adults.find((member) => member.memberId === household.myMemberId);
  const alone = adults.length === 1;
  const ends = household.isHead && alone;

  const leave = useApiAction(async () => {
    await api().leaveHousehold();
    onReload();
  });

  const confirmLeave = async () => {
    const action = ends ? t('m.household.dissolveHousehold') : t('m.household.leaveHousehold');
    const confirmed = await confirmAction({
      title: action,
      message: ends ? t('m.household.dissolveConfirm') : t('m.household.leaveConfirm'),
      confirmLabel: action,
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (confirmed) void leave.run();
  };

  return (
    <View style={styles.sectionContainer}>
      {/* M06: the household, its ID and its area */}
      <SurfaceCard>
        <View style={styles.householdHeader}>
          <View style={styles.flexOne}>
            <AppText step="section" accessibilityRole="header">
              {household.name || t('m.household.title')}
            </AppText>
            <AppText step="caption" style={styles.roleTag}>
              {household.isHead ? t('m.household.headBadge') : t('m.household.adultBadge')}
            </AppText>
          </View>
        </View>
        <View style={styles.facts}>
          <AppText step="label">{t('m.household.householdId')}</AppText>
          <AppText step="body" mono selectable>
            {household.householdCode}
          </AppText>
          {household.places.length > 0 ? (
            household.places.map((place) => (
              <AppText key={place.level} step="secondary" tone="secondary">
                {placeLine(t, localized, place)}
              </AppText>
            ))
          ) : (
            <AppText step="secondary" tone="muted">
              {t('m.household.areaNotSet')}
            </AppText>
          )}
        </View>
      </SurfaceCard>

      {/* Adults: each joined by accepting their own invitation */}
      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('m.household.adultsSection')} ({adults.length})
        </AppText>
        {adults.map((member, index) => (
          <AdultRow
            key={member.id}
            member={member}
            household={household}
            divided={index > 0}
            onChanged={onReload}
          />
        ))}
        {household.isHead ? (
          <View style={styles.topMargin}>
            <Button
              label={t('m.household.inviteAnAdult')}
              variant="secondary"
              icon="person-add-outline"
              onPress={() => router.push('/(member)/household/invite' as any)}
            />
          </View>
        ) : null}
      </SurfaceCard>

      {/* Children: guardian-managed minimum records (OD-31) */}
      <SurfaceCard>
        <AppText step="section" accessibilityRole="header">
          {t('m.household.childrenSection')} ({children.length})
        </AppText>
        {children.length === 0 ? (
          <AppText step="secondary" tone="muted" style={styles.topSmall}>
            {t('m.household.noChildren')}
          </AppText>
        ) : (
          children.map((child, index) => (
            <ChildRow key={child.id} child={child} household={household} divided={index > 0} onChanged={onReload} />
          ))
        )}
        <View style={styles.topMargin}>
          <Button
            label={t('m.household.addMember')}
            variant="secondary"
            icon="add-outline"
            onPress={() => router.push('/(member)/household/add' as any)}
          />
        </View>
      </SurfaceCard>

      {me ? <MyDetailsCard me={me} onSaved={onReload} /> : null}

      {household.isHead && household.pendingInvitations.length > 0 ? (
        <SurfaceCard>
          <View style={styles.rowBetween}>
            <AppText step="section">
              {t('m.household.pendingInvitations')} ({household.pendingInvitations.length})
            </AppText>
            <View>
              <Button
                label={t('m.common.seeAll')}
                variant="quiet"
                onPress={() => router.push('/(member)/household/invitations' as any)}
              />
            </View>
          </View>
        </SurfaceCard>
      ) : null}

      {leave.error ? <Notice tone="error">{errorMessage(t, leave.error)}</Notice> : null}
      {household.isHead && !alone ? (
        <AppText step="secondary" tone="secondary">
          {t('m.household.headLeaveNote')}
        </AppText>
      ) : null}
      <View>
        <Button
          label={ends ? t('m.household.dissolveHousehold') : t('m.household.leaveHousehold')}
          variant="danger"
          onPress={() => void confirmLeave()}
          busy={leave.busy}
        />
      </View>
    </View>
  );
}

function AdultRow({
  member,
  household,
  divided,
  onChanged,
}: {
  member: HouseholdMember;
  household: Household;
  divided: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [relationship, setRelationship] = useState<AdultRel>(
    (ADULT_RELATIONSHIPS as readonly string[]).includes(member.relationship) ? (member.relationship as AdultRel) : 'other',
  );
  const headManages = household.isHead && member.role === 'adult';

  const correct = useApiAction(async () => {
    await api().correctHouseholdRelationship(member.id, { relationship });
    setEditing(false);
    onChanged();
  });
  const remove = useApiAction(async () => {
    await api().removeHouseholdMember(member.id);
    onChanged();
  });
  const confirmRemove = async () => {
    const confirmed = await confirmAction({
      title: t('m.household.removeMember'),
      message: t('m.household.removeConfirm', { name: member.displayName }),
      confirmLabel: t('m.household.removeMember'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (confirmed) void remove.run();
  };

  const details = [
    member.ageBand ? t(`m.household.ageBands.${member.ageBand}`) : null,
    member.occupationCategory ? t(`m.household.occupations.${member.occupationCategory}`) : null,
  ].filter(Boolean);

  return (
    <View style={[styles.memberRow, divided && styles.memberDivider]}>
      <View style={styles.memberNameLine}>
        <AppText step="body" style={styles.memberName}>
          {member.displayName}
        </AppText>
        <StatusTag
          tone="neutral"
          label={member.role === 'head' ? t('m.household.headBadge') : t('m.household.adultBadge')}
        />
      </View>
      <AppText step="caption" style={styles.memberSub}>
        {relationshipLabel(t, member)}
        {member.memberCode ? ` • ${member.memberCode}` : ''}
      </AppText>
      {details.length > 0 ? (
        <AppText step="caption" style={styles.memberSub}>
          {details.join(' • ')}
        </AppText>
      ) : null}

      {headManages && editing ? (
        <View style={styles.editor}>
          <ChipRow<AdultRel>
            label={t('m.household.relationship')}
            selected={relationship}
            onSelect={setRelationship}
            options={ADULT_RELATIONSHIPS.map((key) => ({ key, label: t(`m.household.relationships.${key}`) }))}
          />
          <View style={styles.buttonRow}>
            <View style={styles.flexOne}>
              <Button label={t('m.household.saveRelationship')} busy={correct.busy} onPress={() => void correct.run()} />
            </View>
            <View style={styles.flexOne}>
              <Button label={t('m.common.cancel')} variant="quiet" onPress={() => setEditing(false)} />
            </View>
          </View>
        </View>
      ) : null}
      {correct.error || remove.error ? (
        <Notice tone="error">{errorMessage(t, correct.error ?? remove.error)}</Notice>
      ) : null}
      {headManages && !editing ? (
        <View style={styles.buttonRow}>
          <View style={styles.flexOne}>
            <Button label={t('m.household.correctRelationship')} variant="secondary" onPress={() => setEditing(true)} />
          </View>
          <View style={styles.flexOne}>
            <Button
              label={t('m.household.removeMember')}
              variant="danger"
              busy={remove.busy}
              onPress={() => void confirmRemove()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ChildRow({
  child,
  household,
  divided,
  onChanged,
}: {
  child: HouseholdMember;
  household: Household;
  divided: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const guardian = household.members.find((member) => member.memberId && member.memberId === child.guardianMemberId);
  const guardianName =
    child.guardianMemberId && child.guardianMemberId === household.myMemberId
      ? t('m.household.logActors.you')
      : guardian?.displayName;

  const remove = useApiAction(async () => {
    await api().removeHouseholdDependant(child.id);
    onChanged();
  });
  const confirmRemove = async () => {
    const confirmed = await confirmAction({
      title: t('m.household.removeChild'),
      message: t('m.household.removeChildConfirm', { name: child.displayName }),
      confirmLabel: t('m.household.removeChild'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (confirmed) void remove.run();
  };

  return (
    <View style={[styles.memberRow, divided && styles.memberDivider]}>
      <AppText step="body" style={styles.memberName}>
        {child.displayName}
      </AppText>
      <AppText step="caption" style={styles.memberSub}>
        {relationshipLabel(t, child)}
        {child.birthYear ? ` • ${t('m.household.bornIn', { year: child.birthYear })}` : ''}
      </AppText>
      {guardianName ? (
        <AppText step="caption" style={styles.memberSub}>
          {t('m.household.guardian', { name: guardianName })}
        </AppText>
      ) : null}
      {remove.error ? <Notice tone="error">{errorMessage(t, remove.error)}</Notice> : null}
      {canManageChild(household, child) ? (
        <View style={styles.buttonRow}>
          <View style={styles.flexOne}>
            <Button
              label={t('m.household.edit')}
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/(member)/household/add', params: { id: child.id } } as any)
              }
            />
          </View>
          <View style={styles.flexOne}>
            <Button
              label={t('m.household.removeChild')}
              variant="danger"
              busy={remove.busy}
              onPress={() => void confirmRemove()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { gap: spacing[4] },
  voluntaryBanner: { backgroundColor: colors.surfaceVariant },
  voluntaryTag: { fontWeight: '700', color: colors.primary, marginBottom: spacing[1] },
  voluntaryDetail: { color: colors.textSecondary, marginBottom: spacing[2] },
  description: { color: colors.textSecondary, marginTop: spacing[1] },
  mutedText: { color: colors.textSecondary },
  topMargin: { marginTop: spacing[4] },
  topSmall: { marginTop: spacing[2] },
  inviteNotice: { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
  inviteNoticeTitle: { color: colors.primary },
  formActions: { gap: spacing[2], marginTop: spacing[4] },
  flexOne: { flex: 1 },
  householdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  facts: { gap: 2, marginTop: spacing[2] },
  roleTag: { color: colors.primary, fontWeight: '600', marginTop: 2 },
  memberRow: { paddingVertical: spacing[2], gap: 2 },
  memberDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  memberNameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  memberName: { fontWeight: '600' },
  memberSub: { color: colors.textSecondary, marginTop: 2 },
  editor: { gap: spacing[2], marginTop: spacing[2] },
  buttonRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
