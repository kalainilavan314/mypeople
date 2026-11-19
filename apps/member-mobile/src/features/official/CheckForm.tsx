import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, SurfaceCard, TextField } from '@my-people/mobile-ui';

// The API reads the code out of whatever is pasted (a code, with or without dashes, or a check link).
const INPUT_MAX = 500;

/** M48: a check code or a check link to check against the signed records (FR-AUT-005). */
export function CheckForm({ onCheck, initial = '' }: { onCheck: (code: string) => void; initial?: string }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  const [showError, setShowError] = useState(false);
  const submit = () => {
    if (!value.trim()) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onCheck(value.trim());
  };

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.official.checkTitle')}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {t('m.official.checkIntro')}
      </AppText>
      <TextField
        label={t('m.official.checkLabel')}
        hint={t('m.official.checkHint')}
        value={value}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={INPUT_MAX}
        onChangeText={setValue}
        onSubmitEditing={submit}
        returnKeyType="search"
        error={showError ? t('m.official.checkRequired') : null}
      />
      <Button label={t('m.official.check')} icon="shield-checkmark-outline" onPress={submit} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing[3] } });
