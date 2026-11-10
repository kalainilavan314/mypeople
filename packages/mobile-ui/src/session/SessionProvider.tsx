import { ApiError, type MemberProfile } from '@my-people/api-client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, configureApi } from './api';
import { clearOfflineCard, clearSession, deviceId, readToken, saveTokens } from '../lib/storage';

export type SessionState =
  | { status: 'loading' }
  /** A token is stored but the server could not be reached to check it. */
  | { status: 'unreachable' }
  | { status: 'not_configured' }
  | { status: 'signed_out'; expired: boolean }
  | { status: 'signed_in'; member: MemberProfile };

/** What sign-in and registration return. */
type SignedIn = { token: string; refreshToken: string; member: MemberProfile };

type Session = {
  state: SessionState;
  /** After sign-in or registration: keeps both tokens and the member. */
  start: (signedIn: SignedIn) => Promise<void>;
  /** Ends the session on the server too, then forgets the token. */
  signOut: () => Promise<void>;
  /** A 401 from any request that renewing could not cure: the session ended elsewhere or expired. */
  expire: () => Promise<void>;
  /** Re-reads /v1/members/me, e.g. after verification or the area changes. */
  refresh: () => Promise<void>;
  /** Tries the stored session again after the server was unreachable. */
  retry: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

async function restore(baseUrl: string | undefined): Promise<SessionState> {
  if (!baseUrl) return { status: 'not_configured' };
  configureApi(baseUrl, await deviceId());
  const token = await readToken();
  if (!token) return { status: 'signed_out', expired: false };
  try {
    return { status: 'signed_in', member: await api().getMyProfile() };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession();
      return { status: 'signed_out', expired: true };
    }
    return { status: 'unreachable' }; // keep the token: it may still be good
  }
}

type Props = {
  /** The public API address the app was built with (EXPO_PUBLIC_API_URL); never a secret. */
  baseUrl: string | undefined;
  children: ReactNode;
};

/** The stored session, shared by the member and staff apps. */
export function SessionProvider({ baseUrl, children }: Props) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    restore(baseUrl).then((restored) => active && setState(restored));
    return () => {
      active = false;
    };
  }, [baseUrl]);

  const start = useCallback(async ({ token, refreshToken, member }: SignedIn) => {
    // A new sign-in must never inherit the previous account's saved card.
    await clearOfflineCard();
    await saveTokens(token, refreshToken);
    setState({ status: 'signed_in', member });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api().signOut();
    } catch {
      // The tokens are forgotten here whatever the server answered.
    }
    await clearSession();
    setState({ status: 'signed_out', expired: false });
  }, []);

  const expire = useCallback(async () => {
    await clearSession();
    setState({ status: 'signed_out', expired: true });
  }, []);

  const refresh = useCallback(async () => {
    const member = await api().getMyProfile();
    setState({ status: 'signed_in', member });
  }, []);

  const retry = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await restore(baseUrl));
  }, [baseUrl]);

  const value = useMemo(
    () => ({ state, start, signOut, expire, refresh, retry }),
    [state, start, signOut, expire, refresh, retry],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs SessionProvider');
  return session;
}

/** The signed-in member; only for screens behind the signed-in guard. */
export function useMember(): MemberProfile {
  const { state } = useSession();
  if (state.status !== 'signed_in') throw new Error('useMember needs a signed-in session');
  return state.member;
}
