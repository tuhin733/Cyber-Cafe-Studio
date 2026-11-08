import type { DocumentMakerLayout, DocumentMakerPage } from "./documentMaker";

const DATABASE_NAME = "cyber-cafe-document-library";
const STORE_NAME = "documents";
const DATABASE_VERSION = 1;

export interface SavedDocumentMakerDocument {
  id: string;
  title: string;
  updatedAt: number;
  pages: DocumentMakerPage[];
  layout: DocumentMakerLayout;
}

function isSavedDocument(value: unknown): value is SavedDocumentMakerDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<SavedDocumentMakerDocument>;
  return (
    typeof document.id === "string" &&
    typeof document.title === "string" &&
    typeof document.updatedAt === "number" &&
    Number.isFinite(document.updatedAt) &&
    Array.isArray(document.pages) &&
    document.pages.length > 0 &&
    document.pages.every((page) =>
      page &&
      typeof page.id === "string" &&
      page.content?.type === "doc" &&
      Array.isArray(page.content.content),
    ) &&
    Boolean(document.layout) &&
    ["A4", "Letter", "Legal"].includes(document.layout?.paperSize ?? "") &&
    ["portrait", "landscape"].includes(document.layout?.orientation ?? "") &&
    ["top", "right", "bottom", "left"].every((side) => {
      const margin = document.layout?.margins?.[side as keyof DocumentMakerLayout["margins"]];
      return typeof margin === "number" && Number.isFinite(margin) && margin >= 0 && margin <= 60;
    }) &&
    typeof document.layout?.header === "string" &&
    typeof document.layout?.footer === "string" &&
    typeof document.layout?.pageNumbers === "boolean"
  );
}

function openDocumentDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    return Promise.reject(new Error("Document storage is unavailable in this browser."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open document storage."));
  });
}

export async function listSavedDocumentMakerDocuments(): Promise<SavedDocumentMakerDocument[]> {
  const database = await openDocumentDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const documents: unknown[] = request.result;
        if (!documents.every(isSavedDocument)) {
          reject(new Error("A saved document is damaged and cannot be opened."));
          return;
        }
        resolve(
          documents.sort(
            (left, right) => right.updatedAt - left.updatedAt,
          ),
        );
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Could not load saved documents."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Loading saved documents was interrupted."));
    });
  } finally {
    database.close();
  }
}

export async function saveDocumentMakerDocument(
  document: Omit<SavedDocumentMakerDocument, "updatedAt">,
): Promise<SavedDocumentMakerDocument> {
  const savedDocument = { ...document, updatedAt: Date.now() };
  const database = await openDocumentDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(savedDocument);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not save this document."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving this document was interrupted."));
    });
    return savedDocument;
  } finally {
    database.close();
  }
}

export async function deleteDocumentMakerDocument(id: string): Promise<void> {
  const database = await openDocumentDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not delete this document."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Deleting this document was interrupted."));
    });
  } finally {
    database.close();
  }
}
