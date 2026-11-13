import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, SurfaceCard } from '@my-people/mobile-ui';

type Props = {
  title: string;
  /** What the reference is called: "Reference", "Receipt number". */
  referenceLabel: string;
  reference: string;
  body?: string | null;
  /** Buttons that lead on from the receipt. */
  children?: ReactNode;
};

/**
 * The receipt after the server accepted something (an offer, an idea, a proposal, survey answers):
 * shown only once the server holds it, with its reference in JetBrains Mono.
 */
export function ReceiptCard({ title, referenceLabel, reference, body, children }: Props) {
  return (
    <SurfaceCard style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="checkmark-circle" size={28} color={colors.successText} />
        <AppText step="section" accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.flex}>
          {title}
        </AppText>
      </View>
      <View accessible accessibilityLabel={`${referenceLabel} ${reference}`}>
        <AppText step="secondary" tone="muted">
          {referenceLabel}
        </AppText>
        <AppText step="page" mono>
          {reference}
        </AppText>
      </View>
      {body ? (
        <AppText step="secondary" tone="secondary">
          {body}
        </AppText>
      ) : null}
      {children}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3], borderColor: colors.successText, backgroundColor: colors.successBackground },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
});
