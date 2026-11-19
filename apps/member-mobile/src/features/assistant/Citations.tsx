import Ionicons from '@expo/vector-icons/Ionicons';
import type { AssistantCitation } from '@my-people/api-client';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, iconSize, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, useLocalized } from '@my-people/mobile-ui';

/**
 * Official text quoted word for word from an approved source, kept apart from the AI explanation and
 * labelled as such (FR-AIA-004), then the list of sources with their version and publisher (FR-AIA-003).
 */
export function Citations({ citations }: { citations: AssistantCitation[] }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  if (citations.length === 0) return null;
  const quotes = citations.flatMap((citation) =>
    citation.quotes.map((quote, index) => ({ key: `${citation.sourceId}-${index}`, quote, citation })),
  );

  return (
    <View style={styles.box}>
      {quotes.map(({ key, quote, citation }) => (
        <View key={key} style={styles.official}>
          <View style={styles.officialHead}>
            <Ionicons name="document-text-outline" size={iconSize.chevron} color={colors.primary} style={styles.noShrink} />
            <AppText step="label" tone="primary" style={styles.flex}>
              {t('m.assistant.officialText')}
            </AppText>
          </View>
          <AppText step="body">
            {`“${quote.text}”`}
          </AppText>
          <AppText step="caption" tone="muted">
            {t('m.assistant.officialFrom', { title: localized(citation.titleEn, citation.titleTa) })}
          </AppText>
        </View>
      ))}

      <View style={styles.sources}>
        <AppText step="label">{t('m.assistant.sources')}</AppText>
        {citations.map((citation) => (
          <View key={citation.sourceId} style={styles.source}>
            <AppText step="secondary">{localized(citation.titleEn, citation.titleTa)}</AppText>
            <AppText step="caption" tone="muted">
              {`${t(`m.assistant.kind_${citation.kind}`)} · ${t('m.assistant.sourceDetail', {
                version: citation.version,
                publisher: citation.publisher,
              })}`}
            </AppText>
            {citation.sourceUrl ? (
              <Button
                label={t('m.assistant.openSource')}
                icon="open-outline"
                variant="quiet"
                onPress={() => void Linking.openURL(citation.sourceUrl as string)}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[3] },
  official: {
    gap: spacing[1],
    padding: spacing[3],
    borderRadius: radius.tile,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surfaceVariant,
  },
  officialHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  noShrink: { flexShrink: 0 },
  flex: { flex: 1, minWidth: 0 },
  sources: { gap: spacing[2] },
  source: { gap: 2, paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.divider },
});
