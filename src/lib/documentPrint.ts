import type { LayoutSettings, UploadedDoc } from "../types";
import { paginate } from "./pagination";

export const MAX_DOCUMENT_PRINT_PAGES = 50;
export const MAX_DOCUMENT_PRINT_DATA_URL_SIZE = 120 * 1024 * 1024;

export interface PrintableDocumentImage {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintableDocumentPage {
  images: PrintableDocumentImage[];
}

export type PrintPageMode = "all" | "odd" | "even" | "custom";

export function getPrintPageNumbers(
  mode: PrintPageMode,
  pageCount: number,
  customPages = "",
): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) return [];
  if (mode === "all") {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  if (mode === "odd" || mode === "even") {
    const firstPage = mode === "odd" ? 1 : 2;
    return Array.from(
      { length: Math.max(0, Math.ceil((pageCount - firstPage + 1) / 2)) },
      (_, index) => firstPage + index * 2,
    );
  }

  const value = customPages.trim();
  if (!value) return [];

  const selectedPages = new Set<number>();
  for (const part of value.split(",")) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!match) return [];

    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (
      start < 1 ||
      end < start ||
      end > pageCount ||
      end - start >= MAX_DOCUMENT_PRINT_PAGES
    ) {
      return [];
    }
    for (let page = start; page <= end; page++) {
      selectedPages.add(page);
    }
    if (selectedPages.size > MAX_DOCUMENT_PRINT_PAGES) return [];
  }

  return [...selectedPages].sort((a, b) => a - b);
}

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not read ${file.name} for printing.`));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name} for printing.`));
    reader.readAsDataURL(file);
  });

export async function prepareDocumentPrintPages(
  docs: UploadedDoc[],
  settings: LayoutSettings,
  blankPageCount: number,
  selectedPageNumbers?: number[],
): Promise<PrintableDocumentPage[]> {
  const { pages } = paginate(docs, settings, blankPageCount);
  if (pages.length === 0 || pages.length > MAX_DOCUMENT_PRINT_PAGES) {
    throw new RangeError(
      `Document printing supports 1 to ${MAX_DOCUMENT_PRINT_PAGES} pages per job.`,
    );
  }

  const selectedPages = selectedPageNumbers ?? pages.map((_, index) => index + 1);
  if (
    selectedPages.length === 0 ||
    selectedPages.some(
      (pageNumber) =>
        !Number.isInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > pages.length,
    )
  ) {
    throw new RangeError("Choose at least one valid page to print.");
  }

  const printablePageLayouts = [...new Set(selectedPages)]
    .sort((a, b) => a - b)
    .map((pageNumber) => pages[pageNumber - 1]);
  const printableDocIds = new Set(
    printablePageLayouts.flatMap((page) => page.map(({ doc }) => doc.id)),
  );
  const imagesById = new Map<string, string>();
  const dataUrls = await Promise.all(
    docs.filter((doc) => printableDocIds.has(doc.id)).map(async (doc) => {
      if (!SUPPORTED_IMAGE_TYPES.has(doc.file.type)) {
        throw new TypeError(
          `Printing supports JPG, PNG, and WebP images. Convert ${doc.fileName} and try again.`,
        );
      }
      return [doc.id, await readFileAsDataUrl(doc.file)] as const;
    }),
  );
  for (const [id, dataUrl] of dataUrls) {
    imagesById.set(id, dataUrl);
  }

  const printablePages = printablePageLayouts.map((page) => ({
    images: page.map(({ doc, x, y, w, h }) => {
      const dataUrl = imagesById.get(doc.id);
      if (!dataUrl) {
        throw new Error(`Image data for ${doc.fileName} is unavailable.`);
      }
      return { dataUrl, x, y, width: w, height: h };
    }),
  }));
  const totalDataUrlSize = printablePages.reduce(
    (total, page) =>
      total + page.images.reduce((pageTotal, image) => pageTotal + image.dataUrl.length, 0),
    0,
  );
  if (totalDataUrlSize > MAX_DOCUMENT_PRINT_DATA_URL_SIZE) {
    throw new RangeError(
      "The images are too large to print in one job. Split the documents into smaller batches.",
    );
  }

  return printablePages;
}
