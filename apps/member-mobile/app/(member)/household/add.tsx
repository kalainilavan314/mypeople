import type { HouseholdMember } from '@my-people/api-client';
import { useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  ChipRow,
  Notice,
  Screen,
  SurfaceCard,
  TextField,
  useApiAction,
  useApiQuery,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import {
  CHILD_RELATIONSHIPS,
  type ChildRelationship,
  validChildBirthYear,
  validFirstName,
} from '@/features/household/labels';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/**
 * Screen M07: add or correct a child (MP-FEA-002 §4.1, OD-31 recommendation).
 * A guardian-managed minimum record: first name, relationship and birth year only. Never an ID
 * number, phone or photo, and no account. The verified adult who adds it is its guardian.
 * Adults are never added here: they join only by accepting their own invitation (M08, M09).
 */
export default function AddChildScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const householdQuery = useApiQuery(() => api().getMyHousehold());

  useLayoutEffect(() => {
    navigation.setOptions({ title: id ? t('m.household.editChild') : t('m.household.addMember') });
  }, [id, navigation, t]);

  if (!id) {
    return (
      <Screen edges={['bottom']} maxContentWidth={640}>
        <ChildForm child={null} />
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']} maxContentWidth={640}>
      <QueryView query={householdQuery}>
        {(household) => {
          const child = household?.members.find((member) => member.id === id && member.role === 'dependent');
          return child ? (
            <ChildForm child={child} />
          ) : (
            <Notice tone="error">{t('m.errors.member_record_not_found')}</Notice>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function ChildForm({ child }: { child: HouseholdMember | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [firstName, setFirstName] = useState(child?.displayName ?? '');
  const [relationship, setRelationship] = useState<ChildRelationship>(
    (CHILD_RELATIONSHIPS as readonly string[]).includes(child?.relationship ?? '')
      ? (child?.relationship as ChildRelationship)
      : 'child',
  );
  const [birthYear, setBirthYear] = useState(child?.birthYear ? String(child.birthYear) : '');
  const [touched, setTouched] = useState(false);
  const nameOk = validFirstName(firstName);
  const yearOk = validChildBirthYear(birthYear);

  const save = useApiAction(async () => {
    const body = { firstName: firstName.trim(), relationship, birthYear: Number(birthYear.trim()) };
    if (child) {
      await api().updateHouseholdDependant(child.id, body);
    } else {
      await api().addHouseholdDependant(body);
    }
    router.replace('/household' as any);
  });

  const submit = () => {
    setTouched(true);
    if (nameOk && yearOk) void save.run();
  };

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {child ? t('m.household.editChild') : t('m.household.addMember')}
      </AppText>
      <AppText step="body" tone="secondary">
        {t('m.household.childIntro')}
      </AppText>

      <View style={styles.form}>
        <TextField
          label={t('m.household.firstName')}
          hint={t('m.household.firstNameHint')}
          value={firstName}
          onChangeText={setFirstName}
          maxLength={50}
          autoCapitalize="words"
          autoComplete="off"
          error={touched && !nameOk ? t('m.household.firstNameInvalid') : null}
        />

        <View style={styles.field}>
          <AppText step="label">{t('m.household.relationship')}</AppText>
          <ChipRow<ChildRelationship>
            label={t('m.household.relationship')}
            selected={relationship}
            onSelect={setRelationship}
            options={CHILD_RELATIONSHIPS.map((key) => ({ key, label: t(`m.household.childRelationships.${key}`) }))}
          />
        </View>

        <TextField
          label={t('m.household.birthYear')}
          hint={t('m.household.birthYearHint')}
          value={birthYear}
          onChangeText={(value) => setBirthYear(value.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          error={touched && !yearOk ? t('m.household.birthYearInvalid') : null}
        />

        {save.error ? <Notice tone="error">{errorMessage(t, save.error)}</Notice> : null}
        <Button label={t('m.household.saveChild')} busy={save.busy} onPress={submit} />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2] },
  form: { gap: spacing[4], marginTop: spacing[2] },
  field: { gap: spacing[1] },
});
