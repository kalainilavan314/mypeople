import type { AssistantMessage } from '@my-people/api-client';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Notice } from '@my-people/mobile-ui';

/** The member's question as it was kept: with ID numbers, phone numbers and references removed (FR-AIA-009). */
export function QuestionBubble({ message }: { message: AssistantMessage }) {
  const { t } = useTranslation();
  const removed = message.redactions.map((kind) => t(`m.assistant.removed_${kind}`)).join(', ');
  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <AppText step="caption" tone="primary">
          {t('m.assistant.you')}
        </AppText>
        <AppText step="body">{message.body}</AppText>
      </View>
      {removed ? <Notice tone="warning">{t('m.assistant.removed', { items: removed })}</Notice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '90%',
    minWidth: 0,
    gap: 2,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.card,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
