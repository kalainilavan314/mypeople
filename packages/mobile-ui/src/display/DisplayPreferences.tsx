import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { saveDisplayPreferences, type StoredDisplayPreferences } from '../lib/storage';

/** M44 text sizes; each multiplies the shared type scale (FR-VOI-004). */
export type TextSize = 'standard' | 'large' | 'larger';

export const TEXT_SCALE: Record<TextSize, number> = { standard: 1, large: 1.2, larger: 1.4 };

type DisplayPreferences = StoredDisplayPreferences & {
  setTextSize: (size: TextSize) => void;
  setDataSaver: (on: boolean) => void;
};

const DEFAULTS: StoredDisplayPreferences = { textSize: 'standard', dataSaver: false };

// Without a provider (the staff app) everything shows at the standard size
// with images loading as usual; nothing there offers to change it.
const DisplayContext = createContext<DisplayPreferences>({
  ...DEFAULTS,
  setTextSize: () => undefined,
  setDataSaver: () => undefined,
});

type Props = {
  /** Read before the first screen, so text never jumps size after the splash screen. */
  initial: StoredDisplayPreferences | null;
  children: ReactNode;
};

/**
 * The member's display choices on this device: an in-app text size that
 * works whatever the phone's own setting (FR-VOI-004), and a data saver that
 * loads photos only when tapped (FR-VOI-006). They are not personal data, so
 * like the language they stay on the device after sign-out.
 */
export function DisplayPreferencesProvider({ initial, children }: Props) {
  const [prefs, setPrefs] = useState<StoredDisplayPreferences>(initial ?? DEFAULTS);

  const update = useCallback((change: Partial<StoredDisplayPreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...change };
      void saveDisplayPreferences(next).catch(() => undefined); // still applies for this visit
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...prefs,
      setTextSize: (textSize: TextSize) => update({ textSize }),
      setDataSaver: (dataSaver: boolean) => update({ dataSaver }),
    }),
    [prefs, update],
  );
  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
}

export function useDisplayPreferences(): DisplayPreferences {
  return useContext(DisplayContext);
}

/** The multiplier the member chose for every text size in the app. */
export function useTextScale(): number {
  return TEXT_SCALE[useDisplayPreferences().textSize];
}
