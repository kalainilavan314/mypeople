import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Reloads a tab's data when the member comes back to it, so an answer given
 * on another screen (an RSVP, a confirmed number) shows without pulling down.
 * The first focus is skipped: the screen has just loaded.
 */
export function useReloadOnFocus(reload: () => void) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      reload();
    }, [reload]),
  );
}
