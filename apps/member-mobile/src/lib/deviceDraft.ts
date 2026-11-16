import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// A form being written (an issue report, a development proposal) is kept on this device only, so it
// survives a lost connection or a closed app: a JSON file in the app's private document folder, or
// localStorage in the web version. Nothing here is sent anywhere; failures are swallowed so the form
// keeps working from memory.

export type DraftStorage = {
  read: () => Promise<string | null>;
  write: (text: string) => Promise<void>;
  remove: () => Promise<void>;
};

const isWeb = Platform.OS === 'web';

export function deviceDraftStorage(fileName: string, webKey: string): DraftStorage {
  const draftFile = () => new File(Paths.document, fileName);
  return {
    async read() {
      try {
        if (isWeb) return globalThis.localStorage?.getItem(webKey) ?? null;
        const file = draftFile();
        return file.exists ? await file.text() : null;
      } catch {
        return null;
      }
    },
    async write(text) {
      try {
        if (isWeb) globalThis.localStorage?.setItem(webKey, text);
        else await draftFile().write(text);
      } catch {
        // A full disk or a private browser window: the draft then lasts until the app closes.
      }
    },
    async remove() {
      try {
        if (isWeb) {
          globalThis.localStorage?.removeItem(webKey);
          return;
        }
        const file = draftFile();
        if (file.exists) file.delete();
      } catch {
        // Already gone.
      }
    },
  };
}

/** A draft that belongs to one member: someone else signing in on this phone never sees it. */
export type OwnedDraft = { memberId: string };

/**
 * Writes go one at a time and only the newest waits, so typing never queues up stale copies.
 * null removes the saved copy.
 */
function writer(storage: DraftStorage) {
  let pending: { text: string | null } | null = null;
  let flushing = false;
  const flush = async () => {
    if (flushing) return;
    flushing = true;
    while (pending) {
      const next = pending;
      pending = null;
      if (next.text === null) await storage.remove();
      else await storage.write(next.text);
    }
    flushing = false;
  };
  return (text: string | null) => {
    pending = { text };
    void flush();
  };
}

const writers = new WeakMap<DraftStorage, (text: string | null) => void>();

function persist(storage: DraftStorage, text: string | null) {
  let write = writers.get(storage);
  if (!write) {
    write = writer(storage);
    writers.set(storage, write);
  }
  write(text);
}

/**
 * A draft for a form on one screen, saved on the device after every change. `parse` returns null for
 * a copy it cannot read; a copy left by another member is removed, never shown.
 */
export function useDeviceDraft<T extends OwnedDraft>(
  storage: DraftStorage,
  memberId: string,
  fresh: (memberId: string) => T,
  parse: (text: string) => T | null,
) {
  const [draft, setDraft] = useState<T | null>(null);

  useEffect(() => {
    let active = true;
    void storage.read().then((text) => {
      if (!active) return;
      const saved = text ? parse(text) : null;
      if (saved && saved.memberId === memberId) {
        setDraft(saved);
        return;
      }
      if (text) persist(storage, null);
      setDraft(fresh(memberId));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fresh and parse are plain functions of the module
  }, [storage, memberId]);

  const update = useCallback(
    (change: (current: T) => T) => {
      setDraft((current) => {
        if (!current) return current;
        const next = change(current);
        persist(storage, JSON.stringify(next));
        return next;
      });
    },
    [storage],
  );

  /** After it was sent, or when the member discards it: no copy stays on the device. */
  const reset = useCallback(() => {
    persist(storage, null);
    setDraft(fresh(memberId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fresh is a plain function of the module
  }, [storage, memberId]);

  return { draft, update, reset };
}
