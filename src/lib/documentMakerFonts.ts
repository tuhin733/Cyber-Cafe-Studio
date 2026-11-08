export interface UploadedDocumentFont {
  family: string;
  data: ArrayBuffer;
}

export interface BundledDocumentFont {
  family: string;
  language: "bengali" | "hindi";
  source: string;
}

const BENGALI_FONT_FILES = import.meta.glob(
  "../assets/document-maker-fonts/bengali/*.{ttf,otf,woff,woff2}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;
const HINDI_FONT_FILES = import.meta.glob(
  "../assets/document-maker-fonts/hindi/*.{ttf,otf,woff,woff2}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const DATABASE_NAME = "cyber-cafe-document-maker";
const STORE_NAME = "uploaded-fonts";
const DATABASE_VERSION = 1;

function openFontDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "family" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open font storage."));
  });
}

export async function getUploadedDocumentFonts(): Promise<UploadedDocumentFont[]> {
  const database = await openFontDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as UploadedDocumentFont[]);
    request.onerror = () => reject(request.error ?? new Error("Could not load uploaded fonts."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

export async function saveUploadedDocumentFont(font: UploadedDocumentFont): Promise<void> {
  const database = await openFontDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(font);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save the uploaded font."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Saving the uploaded font was cancelled."));
    };
  });
}

export async function registerDocumentMakerFont(font: UploadedDocumentFont): Promise<void> {
  const face = new FontFace(font.family, font.data);
  await face.load();
  document.fonts.add(face);
}

export async function registerBundledDocumentFont(
  font: BundledDocumentFont,
): Promise<void> {
  const face = new FontFace(font.family, `url("${font.source}")`);
  await face.load();
  document.fonts.add(face);
}

export function getDocumentMakerFontFamily(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getBundledDocumentFonts(): BundledDocumentFont[] {
  const getFonts = (
    files: Record<string, string>,
    language: BundledDocumentFont["language"],
  ) =>
    Object.entries(files).map(([path, source]) => ({
      family: getDocumentMakerFontFamily(path.split("/").pop() ?? ""),
      language,
      source,
    }));

  return [
    ...getFonts(BENGALI_FONT_FILES, "bengali"),
    ...getFonts(HINDI_FONT_FILES, "hindi"),
  ].filter(({ family }) => family.length > 0);
}

export async function getInstalledDocumentFontFamilies(): Promise<string[]> {
  if (window.desktopAPI) {
    if (window.desktopAPI.getInstalledFonts) {
      return window.desktopAPI.getInstalledFonts();
    }

    throw new Error(
      "Restart Cyber Cafe Studio to load installed-font support. If this is an installed copy, update or reinstall the latest version.",
    );
  }

  const queryLocalFonts = (
    navigator as Navigator & {
      queryLocalFonts?: () => Promise<Array<{ family: string }>>;
    }
  ).queryLocalFonts;
  if (!queryLocalFonts) {
    if (navigator.userAgent.includes("Electron")) {
      throw new Error(
        "The desktop app has not loaded installed-font support. Restart Cyber Cafe Studio or update to the latest version.",
      );
    }
    throw new Error("Installed-font scanning is not supported in this browser.");
  }

  const fonts = await queryLocalFonts.call(navigator);
  return [...new Set(fonts.map(({ family }) => family).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}
