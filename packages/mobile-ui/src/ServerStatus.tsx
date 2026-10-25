import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, control, radius, spacing } from '@my-people/design-tokens';

import { textStyle } from './fonts';
import { stringsFor } from './strings';

type Status = 'checking' | 'connected' | 'unavailable' | 'unreachable' | 'notConfigured';

type Props = {
  /** Resolves true when the API answers, false when it reports a problem; throws when unreachable. */
  check: (() => Promise<boolean>) | null;
  language: string;
};

// Status is never shown by colour alone: each state has a symbol and words.
const symbols: Record<Status, string> = {
  checking: '…',
  connected: '✓',
  unavailable: '!',
  unreachable: '!',
  notConfigured: '!',
};

/** Shows whether the app can reach the My People API, with a retry button. */
export function ServerStatus({ check, language }: Props) {
  const text = stringsFor(language);
  const [status, setStatus] = useState<Status>(check ? 'checking' : 'notConfigured');

  const runCheck = useCallback(() => {
    if (!check) return;
    setStatus('checking');
    check()
      .then((connected) => setStatus(connected ? 'connected' : 'unavailable'))
      .catch(() => setStatus('unreachable'));
  }, [check]);

  useEffect(runCheck, [runCheck]);

  const healthy = status === 'connected';
  const canRetry = check !== null && status !== 'checking' && !healthy;

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={[textStyle(language, 'label'), styles.label]}>{text.serverConnection}</Text>
      <Text style={[textStyle(language, 'body'), { color: healthy ? colors.successText : colors.text }]}>
        {symbols[status]} {text[status]}
      </Text>
      {canRetry && (
        <Pressable accessibilityRole="button" onPress={runCheck} style={styles.button}>
          <Text style={[textStyle(language, 'label'), styles.buttonText]}>{text.tryAgain}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing[4],
    gap: spacing[2],
  },
  label: { color: colors.textMuted },
  button: {
    alignSelf: 'flex-start',
    minHeight: control.touchMin,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radius.control,
    backgroundColor: colors.primary,
  },
  buttonText: { color: colors.onPrimary },
});
