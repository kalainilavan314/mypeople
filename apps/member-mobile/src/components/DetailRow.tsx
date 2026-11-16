import { StyleSheet, View } from 'react-native';

import { AppText } from '@my-people/mobile-ui';

/** One labelled detail: the label above, the value under it. */
export function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detail}>
      <AppText step="label">{label}</AppText>
      <AppText step="body" tone="secondary" mono={mono}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({ detail: { gap: 2 } });
