import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import { colors, spacing } from '@my-people/design-tokens';

import { useDisplayPreferences } from '../display/DisplayPreferences';
import { freshToken } from '../session/api';

import { AppText } from './AppText';

type Props = {
  uri: string;
  alt: string;
  /** Shown in place of an image that cannot load (spec §7: never dark art pretending to be a photo). */
  unavailableLabel: string;
  /** With the data saver on (M44), the image waits behind a button with this label; without it, it always loads. */
  tapToLoadLabel?: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
};

/**
 * An image the API serves only to a signed-in person (gallery photos, proof of
 * residence for its reviewer): the app sends its session token; the web
 * preview relies on the session cookie. With the data saver on, nothing is
 * downloaded until the member taps (FR-VOI-006).
 */
export function AuthorizedImage({ uri, alt, unavailableLabel, tapToLoadLabel, style, resizeMode = 'cover' }: Props) {
  const { dataSaver } = useDisplayPreferences();
  const [requested, setRequested] = useState(false);
  const waiting = dataSaver && tapToLoadLabel !== undefined && !requested;

  if (waiting) {
    return (
      <Pressable
        onPress={() => setRequested(true)}
        accessibilityRole="button"
        accessibilityLabel={`${tapToLoadLabel}: ${alt}`}
        style={[styles.unavailable, styles.tap, style]}>
        <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        <AppText step="caption" tone="secondary">
          {tapToLoadLabel}
        </AppText>
      </Pressable>
    );
  }
  return <LoadedImage uri={uri} alt={alt} unavailableLabel={unavailableLabel} style={style} resizeMode={resizeMode} />;
}

function LoadedImage({ uri, alt, unavailableLabel, style, resizeMode }: Omit<Props, 'tapToLoadLabel'>) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    freshToken()
      .catch(() => null) // unreachable: the image then fails and says so
      .then((value) => active && setToken(value));
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
  tap: { gap: spacing[1], minHeight: 44, minWidth: 44 },
});
