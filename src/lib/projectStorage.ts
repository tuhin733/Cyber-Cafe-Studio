import { DEFAULT_LAYOUT } from "../constants";
import { notifyUserError } from "./userErrors";
import type { LayoutSettings, UploadedDoc } from "../types";

const STORAGE_KEY = "cyber-cafe-studio-project-v1";
const IDB_DB_NAME = "cyber-cafe-studio";
const IDB_STORE_NAME = "projects";

type PersistedProject = {
  settings: LayoutSettings;
  blankPageCount?: number;
  docs: Array<
    Omit<UploadedDoc, "file" | "url"> & {
      fileDataUrl?: string;
    }
  >;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

const createFileFromDataUrl = async (
  fileName: string,
  fileDataUrl: string,
  type?: string,
) => {
  if (!fileDataUrl) {
    throw new Error("Missing file data.");
  }

  const response = await fetch(fileDataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, {
    type: type ?? (blob.type || "application/octet-stream"),
  });
};

const openProjectStore = async () => {
  if (!("indexedDB" in globalThis)) {
    throw new Error("IndexedDB is not supported in this browser.");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open projects database."));
  });
};

const saveToIndexedDb = async (payload: PersistedProject): Promise<void> => {
  const db = await openProjectStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, "readwrite");
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.put(payload, STORAGE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Unable to save project."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project save aborted."));
      transaction.oncomplete = () => resolve();
    });
  } finally {
    db.close();
  }
};

const readFromIndexedDb = async (): Promise<PersistedProject | null> => {
  const db = await openProjectStore();
  try {
    return await new Promise<PersistedProject | null>((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, "readonly");
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.get(STORAGE_KEY);

      request.onsuccess = () => {
        const value = request.result as PersistedProject | undefined;
        resolve(value ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error("Unable to load project."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project load aborted."));
    });
  } finally {
    db.close();
  }
};

const deleteFromIndexedDb = async (): Promise<void> => {
  const db = await openProjectStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, "readwrite");
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.delete(STORAGE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Unable to clear project."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Project clear aborted."));
    });
  } finally {
    db.close();
  }
};

const readPersistedProject = async (): Promise<PersistedProject | null> => {
  try {
    const fromIndexedDb = await readFromIndexedDb();
    if (fromIndexedDb) return fromIndexedDb;
  } catch {
    // Fall back to the legacy localStorage snapshot when IndexedDB is unavailable or blocked.
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedProject;
    return parsed && Array.isArray(parsed.docs) ? parsed : null;
  } catch {
    return null;
  }
};

const writePersistedProject = async (payload: PersistedProject): Promise<void> => {
  try {
    await saveToIndexedDb(payload);
    return;
  } catch (indexedDbError) {
    console.warn("Falling back to localStorage for saved project state.", indexedDbError);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const serializeProject = async (
  docs: UploadedDoc[],
  settings: LayoutSettings,
  blankPageCount = 0,
): Promise<void> => {
  const serializedDocs = await Promise.all(
    docs.map(async (doc) => {
      const payloadDoc = {
        ...doc,
        fileDataUrl: doc.file ? await readFileAsDataUrl(doc.file) : undefined,
      };

      delete (payloadDoc as { file?: File }).file;
      delete (payloadDoc as { url?: string }).url;
      return payloadDoc;
    }),
  );

  const payload: PersistedProject = {
    settings,
    blankPageCount,
    docs: serializedDocs,
  };

  await writePersistedProject(payload);
};

export const loadProject = async (): Promise<{
  docs: UploadedDoc[];
  settings: LayoutSettings;
  blankPageCount: number;
} | null> => {
  try {
    const parsed = await readPersistedProject();
    if (!parsed || !Array.isArray(parsed.docs)) return null;

    const docs = await Promise.all(
      parsed.docs.map(async (doc) => {
        const file = await createFileFromDataUrl(
          doc.fileName,
          doc.fileDataUrl ?? "",
          undefined,
        );
        const restoredDoc = { ...doc };
        delete (restoredDoc as { fileDataUrl?: string }).fileDataUrl;

        return {
          ...restoredDoc,
          file,
          url: URL.createObjectURL(file),
        } satisfies UploadedDoc;
      }),
    );

    return {
      docs,
      settings: parsed.settings ?? DEFAULT_LAYOUT,
      blankPageCount: Math.max(
        0,
        Math.floor(parsed.blankPageCount ?? 0),
      ),
    };
  } catch (error) {
    console.error("Unable to restore saved project state:", error);
    notifyUserError(
      "The saved project couldn't be restored. You can continue with a new project.",
    );
    return null;
  }
};

export const clearProject = async () => {
  try {
    await deleteFromIndexedDb();
  } catch {
    // Ignore IndexedDB errors and clean up legacy storage as well.
  }

  localStorage.removeItem(STORAGE_KEY);
};
