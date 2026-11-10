import { CameraView, useCameraPermissions } from 'expo-camera';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, spacing } from '@my-people/design-tokens';
import { AppText, Button, Notice } from '@my-people/mobile-ui';

type Props = {
  /** Called once per code; the screen pauses scanning until the person asks for the next. */
  onScan: (code: string) => void;
  paused: boolean;
  /** Shown when the camera is off: whether this screen has a manual route differs. */
  deniedMessage: string;
};

/**
 * The camera reading QR codes (event passes, member cards). If the camera is
 * refused or broken an event's manual route still works (FR-VOI-007); a card
 * check has none on purpose, so each screen says what to do instead.
 * Nothing is recorded by the camera itself; only the code goes to the API.
 */
export function Scanner({ onScan, paused, deniedMessage }: Props) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return <View style={styles.frame} />;
  if (!permission.granted) {
    return (
      <View style={styles.denied}>
        <Notice tone="warning">{deniedMessage}</Notice>
        {permission.canAskAgain ? (
          <Button label={t('s.checkIn.cameraAsk')} variant="secondary" icon="camera-outline" onPress={() => void requestPermission()} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.frame} accessibilityLabel={t('s.checkIn.cameraTitle')}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={paused ? undefined : ({ data }) => onScan(data)}
      />
      {paused ? (
        <View style={styles.pausedCover}>
          <AppText step="label" tone="inverse">
            ✓
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 1, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.text },
  pausedCover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.primaryDark, opacity: 0.6, alignItems: 'center', justifyContent: 'center' },
  denied: { gap: spacing[3] },
});
