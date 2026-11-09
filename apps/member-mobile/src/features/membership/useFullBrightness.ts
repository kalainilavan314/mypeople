import * as Brightness from 'expo-brightness';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * C02 (MP-DEC-001 §6.1): full brightness while the QR is on screen so a
 * coordinator's scanner reads it first time, and the member's own level back
 * the moment the screen closes. On iPhone this is the whole screen's
 * brightness, so restoring it is not optional. Returns false where the phone
 * would not let the app change it, so the screen can ask the member instead.
 */
export function useFullBrightness(): boolean {
  const [raised, setRaised] = useState(true);

  useEffect(() => {
    let active = true;
    let previous: number | null = null;
    (async () => {
      if (Platform.OS === 'web' || !(await Brightness.isAvailableAsync())) throw new Error('unavailable');
      const level = await Brightness.getBrightnessAsync();
      if (!active) return;
      previous = level;
      await Brightness.setBrightnessAsync(1);
    })().catch(() => active && setRaised(false));

    return () => {
      active = false;
      if (previous !== null) void Brightness.setBrightnessAsync(previous).catch(() => undefined);
    };
  }, []);

  return raised;
}
