import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import { colors, spacing } from '@my-people/design-tokens';

import { readToken } from '../lib/storage';

import { AppText } from './AppText';

type Props = {
  uri: string;
  alt: string;
  /** Shown in place of an image that cannot load (spec §7: never dark art pretending to be a photo). */
  unavailableLabel: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
};

/**
 * An image the API serves only to a signed-in person (gallery photos, proof of
 * residence for its reviewer): the app sends its session token; the web
 * preview relies on the session cookie.
 */
export function AuthorizedImage({ uri, alt, unavailableLabel, style, resizeMode = 'cover' }: Props) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    readToken().then((value) => active && setToken(value));
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <View style={[styles.unavailable, style]} accessibilityLabel={unavailableLabel}>
        <AppText step="caption" tone="muted">
          {unavailableLabel}
        </AppText>
      </View>
    );
  }
  if (token === undefined) return <View style={[styles.placeholder, style]} />;

  return (
    <Image
      source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
      accessibilityLabel={alt}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
      style={[styles.placeholder, style]}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.surfaceVariant },
  unavailable: { backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', padding: spacing[2] },
});
