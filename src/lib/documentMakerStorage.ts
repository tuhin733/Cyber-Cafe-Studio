import type { DocumentMakerLayout, DocumentMakerPage } from "./documentMaker";

const DATABASE_NAME = "cyber-cafe-document-library";
const STORE_NAME = "documents";
const TEMPLATE_STORE_NAME = "templates";
const DATABASE_VERSION = 2;

export interface SavedDocumentMakerDocument {
  id: string;
  title: string;
  updatedAt: number;
  pages: DocumentMakerPage[];
  layout: DocumentMakerLayout;
}

export interface SavedDocumentMakerTemplate {
  id: string;
  title: string;
  description: string;
  updatedAt: number;
  pages: DocumentMakerPage[];
  layout: DocumentMakerLayout;
  isCustom: true;
}

function isValidPages(pages: unknown): pages is DocumentMakerPage[] {
  return Array.isArray(pages) &&
    pages.length > 0 &&
    pages.every((page) =>
      page &&
      typeof page.id === "string" &&
      page.content?.type === "doc" &&
      Array.isArray(page.content.content),
    );
}

function isValidLayout(layout: unknown): layout is DocumentMakerLayout {
  if (!layout || typeof layout !== "object") return false;
  const documentLayout = layout as DocumentMakerLayout;
  return (
    ["A4", "Letter", "Legal"].includes(documentLayout.paperSize) &&
    ["portrait", "landscape"].includes(documentLayout.orientation) &&
    (["top", "right", "bottom", "left"] as const).every((side) => {
      const margin = documentLayout.margins?.[side];
      return typeof margin === "number" && Number.isFinite(margin) && margin >= 0 && margin <= 60;
    }) &&
    typeof documentLayout.header === "string" &&
    typeof documentLayout.footer === "string" &&
    typeof documentLayout.pageNumbers === "boolean"
  );
}

function isSavedDocument(value: unknown): value is SavedDocumentMakerDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<SavedDocumentMakerDocument>;
  return (
    typeof document.id === "string" &&
    typeof document.title === "string" &&
    typeof document.updatedAt === "number" &&
    Number.isFinite(document.updatedAt) &&
    isValidPages(document.pages) &&
    isValidLayout(document.layout)
  );
}

function isSavedTemplate(value: unknown): value is SavedDocumentMakerTemplate {
  if (!value || typeof value !== "object") return false;
  const template = value as Partial<SavedDocumentMakerTemplate>;
  return (
    typeof template.id === "string" &&
    typeof template.title === "string" &&
    typeof template.description === "string" &&
    typeof template.updatedAt === "number" &&
    Number.isFinite(template.updatedAt) &&
    template.isCustom === true &&
    isValidPages(template.pages) &&
    isValidLayout(template.layout)
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
      if (!request.result.objectStoreNames.contains(TEMPLATE_STORE_NAME)) {
        request.result.createObjectStore(TEMPLATE_STORE_NAME, { keyPath: "id" });
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

export async function listSavedDocumentMakerTemplates(): Promise<SavedDocumentMakerTemplate[]> {
  const database = await openDocumentDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(TEMPLATE_STORE_NAME, "readonly");
      const request = transaction.objectStore(TEMPLATE_STORE_NAME).getAll();
      request.onsuccess = () => {
        const templates: unknown[] = request.result;
        if (!templates.every(isSavedTemplate)) {
          reject(new Error("A saved template is damaged and cannot be opened."));
          return;
        }
        resolve(templates.sort((left, right) => right.updatedAt - left.updatedAt));
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Could not load saved templates."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Loading saved templates was interrupted."));
    });
  } finally {
    database.close();
  }
}

export async function saveDocumentMakerTemplate(
  template: Omit<SavedDocumentMakerTemplate, "updatedAt" | "isCustom">,
): Promise<SavedDocumentMakerTemplate> {
  const savedTemplate: SavedDocumentMakerTemplate = {
    ...template,
    updatedAt: Date.now(),
    isCustom: true,
  };
  const database = await openDocumentDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(TEMPLATE_STORE_NAME, "readwrite");
      transaction.objectStore(TEMPLATE_STORE_NAME).put(savedTemplate);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not save this template."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving this template was interrupted."));
    });
    return savedTemplate;
  } finally {
    database.close();
  }
}

export async function deleteDocumentMakerTemplate(id: string): Promise<void> {
  const database = await openDocumentDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(TEMPLATE_STORE_NAME, "readwrite");
      transaction.objectStore(TEMPLATE_STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not delete this template."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Deleting this template was interrupted."));
    });
  } finally {
    database.close();
  }
}
