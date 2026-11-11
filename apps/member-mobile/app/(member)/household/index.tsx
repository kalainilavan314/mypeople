import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  confirmAction,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * Screen M06: My Household / எனது குடும்பம்
 * BRD v1.1 SC-22, FR-HH-001, FR-HH-002, FR-HH-003, BR-098.
 * Strictly voluntary family module.
 */
export default function HouseholdScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const householdQuery = useApiQuery(() => api().getMyHousehold());
  const invitationsQuery = useApiQuery(() => api().getMyInvitations());

  return (
    <Screen edges={['bottom']}>
      {/* Voluntary banner (BR-098) */}
      <SurfaceCard style={styles.voluntaryBanner}>
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
        {(household) => {
          if (!household) {
            return (
              <NoHouseholdView
                onCreated={() => {
                  void householdQuery.reload();
                  void invitationsQuery.reload();
                }}
                invitationsCount={invitationsQuery.data?.received.length ?? 0}
              />
            );
          }
          return (
            <ActiveHouseholdView
              household={household}
              onReload={() => {
                void householdQuery.reload();
                void invitationsQuery.reload();
              }}
            />
          );
        }}
      </QueryView>
    </Screen>
  );
}

function NoHouseholdView({
  onCreated,
  invitationsCount,
}: {
  onCreated: () => void;
  invitationsCount: number;
}) {
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
          <AppText step="body" style={styles.inviteNoticeDesc}>
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
            <Button
              label={t('m.household.createButton')}
              onPress={() => setShowForm(true)}
            />
          </View>
        ) : (
          <View style={styles.topMargin}>
            <TextField
              label={t('m.household.householdName')}
              value={name}
              onChangeText={setName}
              placeholder={t('m.household.householdNamePlaceholder')}
              autoFocus
            />
            {create.error ? (
              <View style={styles.topMargin}>
                <Notice tone="error">
                  {errorMessage(t, create.error)}
                </Notice>
              </View>
            ) : null}
            <View style={styles.rowButtons}>
              <View style={styles.flexOne}>
                <Button
                  label={t('m.common.cancel')}
                  variant="secondary"
                  onPress={() => setShowForm(false)}
                />
              </View>
              <View style={styles.flexOne}>
                <Button
                  label={t('m.household.createButton')}
                  busy={create.busy}
                  onPress={() => void create.run()}
                />
              </View>
            </View>
          </View>
        )}
      </SurfaceCard>
    </View>
  );
}

function ActiveHouseholdView({
  household,
  onReload,
}: {
  household: NonNullable<ReturnType<typeof api>['getMyHousehold'] extends () => Promise<infer U> ? U : never>;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const leave = useApiAction(async () => {
    await api().leaveHousehold();
    onReload();
  });

  const removeMember = useApiAction(async (memberId: string) => {
    await api().removeHouseholdMember(memberId);
    onReload();
  });

  const confirmLeave = async () => {
    const isHead = household.isHead;
    const action = isHead ? t('m.household.dissolveHousehold') : t('m.household.leaveHousehold');
    const confirmed = await confirmAction({
      title: action,
      message: isHead ? t('m.household.dissolveConfirm') : t('m.household.leaveConfirm'),
      confirmLabel: action,
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (confirmed) void leave.run();
  };

  const confirmRemove = async (recordId: string, displayName: string) => {
    const confirmed = await confirmAction({
      title: t('m.household.removeMember'),
      message: t('m.household.removeConfirm', { name: displayName }),
      confirmLabel: t('m.household.removeMember'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (confirmed) void removeMember.run(recordId);
  };

  return (
    <View style={styles.sectionContainer}>
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

        <AppText step="caption" style={styles.membersCount}>
          {t('m.household.membersSection')} ({household.members.length})
        </AppText>

        {household.members.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <View style={styles.flexOne}>
              <View style={styles.memberNameLine}>
                <AppText step="body" style={styles.memberName}>
                  {member.displayName}
                </AppText>
                <AppText step="caption" style={styles.memberRoleBadge}>
                  {member.role === 'head'
                    ? t('m.household.headBadge')
                    : t('m.household.adultBadge')}
                </AppText>
              </View>
              <AppText step="caption" style={styles.memberSub}>
                {t(`m.household.relationships.${member.relationship}` as const, member.relationship)}
                {member.memberCode ? ` • ${member.memberCode}` : ''}
              </AppText>
            </View>

            {household.isHead && member.role !== 'head' && (
              <View>
                <Button
                  label={t('m.common.cancel')}
                  variant="secondary"
                  onPress={() => confirmRemove(member.id, member.displayName)}
                />
              </View>
            )}
          </View>
        ))}

        {household.isHead && (
          <View style={styles.topMargin}>
            <Button
              label={t('m.household.addMember')}
              onPress={() => router.push('/(member)/household/add' as any)}
            />
          </View>
        )}
      </SurfaceCard>

      {/* Pending invitations for head */}
      {household.isHead && (
        <SurfaceCard style={styles.topMargin}>
          <View style={styles.rowBetween}>
            <AppText step="section">
              {t('m.household.pendingInvitations')} ({household.pendingInvitations.length})
            </AppText>
            <View>
              <Button
                label={t('m.common.seeAll')}
                variant="secondary"
                onPress={() => router.push('/(member)/household/invitations' as any)}
              />
            </View>
          </View>
        </SurfaceCard>
      )}

      {/* Voluntary Exit / Dissolve button */}
      <View style={styles.topMargin}>
        <Button
          label={household.isHead ? t('m.household.dissolveHousehold') : t('m.household.leaveHousehold')}
          variant="secondary"
          onPress={confirmLeave}
          busy={leave.busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    gap: spacing[4],
  },
  voluntaryBanner: {
    backgroundColor: colors.surfaceVariant,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: spacing[2],
  },
  voluntaryTag: {
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing[1],
  },
  voluntaryDetail: {
    color: colors.textSecondary,
    marginBottom: spacing[2],
  },
  description: {
    color: colors.textSecondary,
    marginTop: spacing[1],
  },
  topMargin: {
    marginTop: spacing[4],
  },
  inviteNotice: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.border,
  },
  inviteNoticeTitle: {
    color: colors.primary,
  },
  inviteNoticeDesc: {
    color: colors.textSecondary,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  flexOne: {
    flex: 1,
  },
  householdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  roleTag: {
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  membersCount: {
    marginTop: spacing[4],
    marginBottom: spacing[1],
    color: colors.textSecondary,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  memberName: {
    fontWeight: '600',
  },
  memberRoleBadge: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing[1],
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    color: colors.textSecondary,
  },
  memberSub: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
