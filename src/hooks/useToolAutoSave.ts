import { useCallback, useEffect, useRef, useState } from "react";
import { loadToolSession, saveToolSession } from "../lib/toolSessionStorage";
import type { AutoSaveStatus } from "../lib/autoSaveStatus";

export function useToolAutoSave<T>(
  key: string,
  snapshot: T,
  restore: (saved: T) => Promise<void>,
  enabled = true,
) {
  const [status, setStatus] = useState<AutoSaveStatus>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveRequestRef = useRef(0);
  const isLoadedRef = useRef(false);
  const latestSnapshotRef = useRef(snapshot);
  isLoadedRef.current = isLoaded;
  latestSnapshotRef.current = snapshot;

  useEffect(() => {
    let active = true;
    setIsLoaded(false);
    setStatus("loading");
    void loadToolSession<T>(key)
      .then(async (session) => {
        if (session !== null) await restore(session.value);
        if (!active) return;
        setIsLoaded(true);
        setLastSavedAt(session?.savedAt ?? null);
        setStatus(session?.savedAt == null ? "pending" : "saved");
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error(`Unable to restore ${key} session`, error);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [key, loadAttempt, restore]);

  useEffect(() => {
    if (!isLoaded || !enabled) return;
    const requestId = ++saveRequestRef.current;
    setStatus("pending");
    const timeout = window.setTimeout(() => {
      setStatus("saving");
      const saveRequest = saveQueueRef.current.then(() =>
        saveToolSession(key, snapshot),
      );
      saveQueueRef.current = saveRequest.then(() => undefined, () => undefined);
      void saveRequest
        .then((savedAt) => {
          if (requestId === saveRequestRef.current) {
            setLastSavedAt(savedAt);
            setStatus("saved");
          }
        })
        .catch((error: unknown) => {
          if (requestId !== saveRequestRef.current) return;
          console.error(`Unable to autosave ${key} session`, error);
          setStatus("error");
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [enabled, isLoaded, key, saveAttempt, snapshot]);

  useEffect(() => () => {
    if (!isLoadedRef.current) return;
    const finalSave = saveQueueRef.current.then(() =>
      saveToolSession(key, latestSnapshotRef.current),
    );
    saveQueueRef.current = finalSave.then(
      () => undefined,
      (error: unknown) => {
        console.error(`Unable to save ${key} session when leaving the tool`, error);
      },
    );
  }, [key]);

  const retry = useCallback(() => {
    if (isLoaded) setSaveAttempt((attempt) => attempt + 1);
    else setLoadAttempt((attempt) => attempt + 1);
  }, [isLoaded]);

  return { status, retry, isLoaded, lastSavedAt };
}
