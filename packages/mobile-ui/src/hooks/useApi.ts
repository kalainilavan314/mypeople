import { ApiError } from '@my-people/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '../session/SessionProvider';

/**
 * A 401 means the session ended only with these codes; other 401s answer the
 * request itself (a wrong current password, a wrong one-time code).
 */
export function sessionEnded(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && (error.code === 'unauthorized' || error.code === 'session_expired');
}

export type Loaded<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
};

/**
 * Loads data for a screen and reloads it on request. An ended session
 * (expired or revoked elsewhere) goes back to sign-in instead of showing an
 * error on every screen.
 */
export function useApiQuery<T>(load: () => Promise<T>, deps: readonly unknown[] = []): Loaded<T> {
  const { expire } = useSession();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load; // the newest closure, without reloading on every render
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    loader
      .current()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (sessionEnded(caught)) void expire();
        setError(caught);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller lists what the request depends on
  }, [attempt, expire, ...deps]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, loading, reload };
}

/**
 * Runs one change (a form submit, an RSVP) and keeps its busy and error state.
 * The screen shows success only after the server confirmed it.
 */
export function useApiAction<A extends unknown[], T>(action: (...args: A) => Promise<T>) {
  const { expire } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const runner = useRef(action);
  useEffect(() => {
    runner.current = action;
  });

  const run = useCallback(
    async (...args: A): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await runner.current(...args);
      } catch (caught) {
        if (sessionEnded(caught)) void expire();
        setError(caught);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [expire],
  );

  return { run, busy, error, clearError: () => setError(null) };
}
