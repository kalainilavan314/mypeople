import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens';
import {
  AppText,
  Button,
  ChipRow,
  formatDate,
  Screen,
  StatusTag,
  SurfaceCard,
  useLanguage,
  useSession,
} from '@my-people/mobile-ui';

import { areaLabel, tierLabel } from '@/features/staff/areaLabel';
import { chooseLanguage } from '@/lib/i18n';
import { useStaff } from '@/providers/StaffProvider';

/**
 * S01 role context: every staff role that counts now, its area, its
 * permissions and when its yearly review is due (RB-05).
 */
export default function RoleScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { signOut, state } = useSession();
  const { assignments } = useStaff();
  const member = state.status === 'signed_in' ? state.member : null;

  return (
    <Screen edges={[]}>
      {member ? (
        <SurfaceCard>
          <AppText step="section">{member.fullName}</AppText>
          <AppText step="secondary" tone="muted" mono>
            {member.memberCode}
          </AppText>
          <StatusTag tone="verified" label={t('s.profile.secondFactor')} />
        </SurfaceCard>
      ) : null}
      <AppText step="section" accessibilityRole="header">
        {t('s.profile.roles')}
      </AppText>
      {assignments.map((assignment) => (
        <SurfaceCard key={assignment.id}>
          <AppText step="card">{`${tierLabel(assignment)} · ${areaLabel(assignment)}`}</AppText>
          {assignment.reviewDueAt ? (
            <AppText step="secondary" tone="muted">
              {t('s.profile.reviewDue', { date: formatDate(assignment.reviewDueAt, language) })}
            </AppText>
          ) : null}
          <AppText step="label">{t('s.profile.permissions')}</AppText>
          <View style={styles.permissions}>
            {assignment.permissions.map((permission) => (
              <AppText key={permission} step="caption" tone="secondary" mono>
                {permission}
              </AppText>
            ))}
          </View>
        </SurfaceCard>
      ))}
      <AppText step="label">{t('s.profile.language')}</AppText>
      <ChipRow
        label={t('s.profile.language')}
        selected={language}
        onSelect={(next) => void chooseLanguage(next)}
        options={[
          { key: 'ta', label: 'தமிழ்' },
          { key: 'en', label: 'English' },
        ]}
      />
      <Button label={t('s.common.signOut')} variant="danger" icon="log-out-outline" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({ permissions: { gap: spacing[1] } });
