import { useEffect, useState } from 'react';

/** Tracks navigator.onLine and fires callbacks on transitions. */
export function useOnline(onReconnect?: () => void): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      onReconnect?.();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, [onReconnect]);

  return online;
}
