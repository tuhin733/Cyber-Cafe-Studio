const DB_NAME = "cyber-cafe-studio-tool-sessions";
const STORE_NAME = "sessions";

interface StoredToolSession<T> {
  autosaveVersion: 1;
  savedAt: number;
  value: T;
}

function openSessionStore() {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("Autosave is unavailable in this browser."));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open tool autosave storage."));
  });
}

export async function loadToolSession<T>(
  key: string,
): Promise<{ value: T; savedAt: number | null } | null> {
  const db = await openSessionStore();
  try {
    return await new Promise<{ value: T; savedAt: number | null } | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => {
        const stored = request.result as StoredToolSession<T> | T | undefined;
        if (stored === undefined) {
          resolve(null);
          return;
        }
        if (
          typeof stored === "object" &&
          stored !== null &&
          "autosaveVersion" in stored &&
          stored.autosaveVersion === 1 &&
          "value" in stored
        ) {
          resolve({
            value: stored.value as T,
            savedAt: typeof stored.savedAt === "number" ? stored.savedAt : null,
          });
          return;
        }
        resolve({ value: stored as T, savedAt: null });
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Unable to load the saved tool session."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Loading the saved session was interrupted."));
    });
  } finally {
    db.close();
  }
}

export async function saveToolSession<T>(key: string, value: T): Promise<number> {
  const db = await openSessionStore();
  const savedAt = Date.now();
  try {
    return await new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const session: StoredToolSession<T> = {
        autosaveVersion: 1,
        savedAt,
        value,
      };
      transaction.objectStore(STORE_NAME).put(session, key);
      transaction.oncomplete = () => resolve(savedAt);
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Unable to save the tool session."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving the tool session was interrupted."));
    });
  } finally {
    db.close();
  }
}
