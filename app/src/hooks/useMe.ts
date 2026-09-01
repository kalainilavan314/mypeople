import { useEffect, useState } from 'react';
import { authApi, cachedMember, type ServerMember } from '../data/authApi';

// The real signed-in member (from the backend), with the cached copy shown
// instantly and refreshed from /api/me on mount (live recruit count + tier).
export function useMe() {
  const [member, setMember] = useState<ServerMember | null>(() => cachedMember());
  useEffect(() => {
    let alive = true;
    authApi
      .me()
      .then((m) => {
        if (alive && m) setMember(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return member;
}
