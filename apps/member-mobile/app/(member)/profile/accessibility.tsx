import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';

import { AppText, ChipRow, Screen, SurfaceCard, type TextSize, useDisplayPreferences } from '@my-people/mobile-ui';

/**
 * M44: an in-app text size that works whatever the phone's own setting
 * (FR-VOI-004) and a data saver that loads photos only when tapped
 * (FR-VOI-006). Both apply at once and stay on this phone. Voice input and
 * audio guidance (FR-VOI-001 to 003) arrive in Phase 3.
 */
export default function AccessibilityScreen() {
  const { t } = useTranslation();
  const { textSize, dataSaver, setTextSize, setDataSaver } = useDisplayPreferences();

  return (
    <Screen edges={['bottom']}>
      <AppText step="section" accessibilityRole="header">
        {t('m.accessibility.textSize')}
      </AppText>
      <AppText step="secondary" tone="muted">
        {t('m.accessibility.textSizeHint')}
      </AppText>
      <ChipRow<TextSize>
        label={t('m.accessibility.textSize')}
        selected={textSize}
        onSelect={setTextSize}
        options={[
          { key: 'standard', label: t('m.accessibility.standard') },
          { key: 'large', label: t('m.accessibility.large') },
          { key: 'larger', label: t('m.accessibility.larger') },
        ]}
      />
      <SurfaceCard>
        <AppText step="label">{t('m.accessibility.previewTitle')}</AppText>
        <AppText step="body">{t('m.accessibility.previewBody')}</AppText>
      </SurfaceCard>

      <AppText step="section" accessibilityRole="header">
        {t('m.accessibility.dataSaver')}
      </AppText>
      <SurfaceCard>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText step="label">{t('m.accessibility.dataSaverLabel')}</AppText>
            <AppText step="secondary" tone="muted">
              {t('m.accessibility.dataSaverHint')}
            </AppText>
          </View>
          <Switch
            value={dataSaver}
            onValueChange={setDataSaver}
            accessibilityLabel={t('m.accessibility.dataSaverLabel')}
            trackColor={{ true: colors.primary, false: colors.inputBorder }}
          />
        </View>
      </SurfaceCard>

      <AppText step="section" accessibilityRole="header">
        {t('m.accessibility.otherWays')}
      </AppText>
      <SurfaceCard>
        <AppText step="body" tone="secondary">
          {t('m.accessibility.otherWaysBody')}
        </AppText>
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 56 },
  flex: { flex: 1, gap: 2 },
});
