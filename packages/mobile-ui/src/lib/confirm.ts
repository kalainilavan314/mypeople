import { Alert, Platform } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
};

/**
 * Asks the person to confirm an action and resolves true only when they do.
 *
 * React Native's Alert.alert does nothing in a browser, so an action that waited
 * for it never ran in the web build (the party fund's Submit, Dissolve household).
 * The web build uses the browser's own dialog instead.
 */
export function confirmAction({ title, message, confirmLabel, cancelLabel, destructive = false }: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Shows a short message with a single OK; the browser's dialog on the web build. */
export function showMessage(title: string, message: string): void {
  if (Platform.OS === 'web') {
    globalThis.alert?.(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
