import type { PromiseUpdateItem } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, formatDate, SurfaceCard, useLanguage, useLocalized } from '@my-people/mobile-ui';

import { PromiseStatusTag } from './PromiseTags';

/**
 * Dated progress updates, newest first. A correction is shown beside the update it corrects, which
 * stays visible as it was (FR-PRM-005).
 */
export function PromiseUpdates({ updates }: { updates: PromiseUpdateItem[] }) {
  const { t } = useTranslation();
  const ids = new Set(updates.map((update) => update.id));
  const corrections = (id: string) => updates.filter((update) => update.correctsId === id);
  // Corrections of an update that is not shown still appear, on their own.
  const originals = updates
    .filter((update) => !update.correctsId || !ids.has(update.correctsId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <SurfaceCard style={styles.card}>
      <AppText step="section" accessibilityRole="header">
        {t('m.promises.updates')}
      </AppText>
      {originals.length === 0 ? (
        <AppText step="secondary" tone="muted">
          {t('m.promises.noUpdates')}
        </AppText>
      ) : (
        originals.map((update, index) => (
          <View key={update.id} style={[styles.entry, index > 0 && styles.divider]}>
            <UpdateEntry update={update} />
            {corrections(update.id).map((correction) => (
              <View key={correction.id} style={styles.correction}>
                <AppText step="caption" tone="primary">
                  {t('m.promises.correction')}
                </AppText>
                <UpdateEntry update={correction} />
              </View>
            ))}
          </View>
        ))
      )}
    </SurfaceCard>
  );
}

function UpdateEntry({ update }: { update: PromiseUpdateItem }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  return (
    <View style={styles.update}>
      <AppText step="caption" tone="muted">
        {formatDate(update.decidedAt ?? update.createdAt, language)}
      </AppText>
      {update.newStatus ? <PromiseStatusTag status={update.newStatus} /> : null}
      <AppText step="body">{localized(update.noteEn, update.noteTa)}</AppText>
      {update.evidenceRefs.length > 0 ? (
        <View style={styles.update}>
          <AppText step="label">{t('m.promises.evidence')}</AppText>
          {update.evidenceRefs.map((reference) => (
            <AppText key={reference} step="secondary" tone="secondary" mono selectable>
              {reference}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  entry: { gap: spacing[2] },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing[3] },
  update: { gap: 2 },
  correction: { gap: 2, paddingLeft: spacing[3], borderLeftWidth: 3, borderLeftColor: colors.primary },
});
