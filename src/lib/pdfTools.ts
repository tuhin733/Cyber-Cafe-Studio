import { decryptPDF, isEncrypted } from "@pdfsmaller/pdf-decrypt";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import {
  degrees,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFStream,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PdfOutput {
  bytes: Uint8Array;
  filename: string;
}

export interface UnlockedPdf {
  bytes: Uint8Array;
  flattened: boolean;
}

export function parsePageRanges(value: string, pageCount: number): number[][] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
    throw new RangeError("The PDF has no pages.");
  }
  const groups = value.split(",").map((part) => part.trim());
  if (!groups.length || groups.some((part) => !part)) {
    throw new RangeError("Enter page numbers or ranges, such as 1-3, 5-6.");
  }
  const seen = new Set<number>();
  return groups.map((group) => {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(group);
    if (!match) {
      throw new RangeError("Enter page numbers or ranges, such as 1-3, 5-6.");
    }
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > pageCount) {
      throw new RangeError(`Page ranges must be between 1 and ${pageCount}.`);
    }
    const pages = Array.from({ length: last - first + 1 }, (_, index) => first + index);
    if (pages.some((page) => seen.has(page))) {
      throw new RangeError("Page ranges cannot contain duplicate pages.");
    }
    pages.forEach((page) => seen.add(page));
    return pages;
  });
}

export function parsePageOrder(value: string, pageCount: number): number[] {
  const parts = value.split(",").map((part) => part.trim());
  const order = parts.map(Number);
  if (
    !parts.length ||
    parts.some((part) => !/^\d+$/.test(part)) ||
    order.length !== pageCount ||
    new Set(order).size !== pageCount ||
    order.some((page) => page < 1 || page > pageCount)
  ) {
    throw new RangeError(
      `Enter every page from 1 to ${pageCount} exactly once, in the order you want.`,
    );
  }
  return order;
}

export async function deletePdfPages(file: File, pagesToDelete: number[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const pageCount = pdf.getPageCount();
  if (
    !pagesToDelete.length ||
    new Set(pagesToDelete).size !== pagesToDelete.length ||
    pagesToDelete.some((page) => !Number.isSafeInteger(page) || page < 1 || page > pageCount)
  ) {
    throw new RangeError(`Choose page numbers between 1 and ${pageCount}, without duplicates.`);
  }
  if (pagesToDelete.length >= pageCount) {
    throw new RangeError("At least one page must remain in the PDF.");
  }
  pagesToDelete
    .map((page) => page - 1)
    .sort((left, right) => right - left)
    .forEach((pageIndex) => pdf.removePage(pageIndex));
  return pdf.save();
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

function getBaseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "") || "document";
}

export async function mergePdfFiles(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) throw new RangeError("Select at least two PDF files to merge.");
  const output = await PDFDocument.create();
  for (const file of files) {
    const source = await PDFDocument.load(await file.arrayBuffer());
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return output.save();
}

export async function splitPdfFile(
  file: File,
  ranges: number[][],
): Promise<PdfOutput[]> {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const baseName = getBaseName(file.name);
  return Promise.all(
    ranges.map(async (range, index) => {
      const output = await PDFDocument.create();
      const pages = await output.copyPages(source, range.map((page) => page - 1));
      pages.forEach((page) => output.addPage(page));
      return {
        bytes: await output.save(),
        filename: `${baseName}-part-${index + 1}.pdf`,
      };
    }),
  );
}

export async function organizePdfFile(file: File, order: number[]): Promise<Uint8Array> {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, order.map((page) => page - 1));
  pages.forEach((page) => output.addPage(page));
  return output.save();
}

export async function rotatePdfFile(file: File, angle: number): Promise<Uint8Array> {
  if (![90, 180, 270].includes(angle)) throw new RangeError("Choose a 90, 180, or 270 degree rotation.");
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  for (const page of pdf.getPages()) {
    page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  }
  return pdf.save();
}

export async function cropPdfFile(file: File, marginPercent: number): Promise<Uint8Array> {
  if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 40) {
    throw new RangeError("Crop margins must be between 0 and 40 percent.");
  }
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const marginX = width * marginPercent / 100;
    const marginY = height * marginPercent / 100;
    page.setCropBox(marginX, marginY, width - marginX * 2, height - marginY * 2);
  }
  return pdf.save();
}

export async function addPageNumbers(file: File): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const label = `${index + 1} / ${pages.length}`;
    const size = 10;
    page.drawText(label, {
      x: width - font.widthOfTextAtSize(label, size) - 28,
      y: 18,
      size,
      font,
      color: rgb(0.25, 0.29, 0.33),
    });
  });
  return pdf.save();
}

const CYBER_CAFE_WATERMARK_KEY = PDFName.of("CyberCafeStudioWatermark");

export type PdfWatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "diagonal";

export interface PdfWatermarkOptions {
  type: "text" | "image";
  text: string;
  image?: File | null;
  opacity: number;
  position: PdfWatermarkPosition;
  size: number;
  rotation: number;
  pages?: number[];
  color: string;
}

export interface PdfWatermarkRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlattenedWatermarkRemovalOptions {
  region?: PdfWatermarkRegion;
  text?: string;
  pages?: number[];
  fillColor: string;
}

function parseWatermarkColor(color: string): ReturnType<typeof rgb> {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) throw new RangeError("Choose a valid watermark color.");
  return rgb(
    Number.parseInt(match[1], 16) / 255,
    Number.parseInt(match[2], 16) / 255,
    Number.parseInt(match[3], 16) / 255,
  );
}

function getWatermarkPosition(
  position: PdfWatermarkPosition,
  width: number,
  height: number,
  watermarkWidth: number,
  watermarkHeight: number,
): { x: number; y: number; angle: number } {
  const margin = Math.min(width, height) * 0.06;
  switch (position) {
    case "top-left": return { x: margin, y: height - watermarkHeight - margin, angle: 0 };
    case "top-right": return { x: width - watermarkWidth - margin, y: height - watermarkHeight - margin, angle: 0 };
    case "bottom-left": return { x: margin, y: margin, angle: 0 };
    case "bottom-right": return { x: width - watermarkWidth - margin, y: margin, angle: 0 };
    case "diagonal": return {
      x: (width - watermarkWidth) / 2,
      y: (height - watermarkHeight) / 2,
      angle: -45,
    };
    case "center": return {
      x: (width - watermarkWidth) / 2,
      y: (height - watermarkHeight) / 2,
      angle: 0,
    };
  }
}

export async function addPdfWatermark(
  file: File,
  options: PdfWatermarkOptions,
): Promise<Uint8Array> {
  const watermarkText = options.text.trim();
  if (options.type === "text" && !watermarkText) {
    throw new RangeError("Enter text for the watermark.");
  }
  if (watermarkText.length > 100) {
    throw new RangeError("Watermark text must be 100 characters or fewer.");
  }
  if (!Number.isFinite(options.opacity) || options.opacity < 0.05 || options.opacity > 0.8) {
    throw new RangeError("Watermark opacity must be between 5 and 80 percent.");
  }
  if (!Number.isFinite(options.size) || options.size < 10 || options.size > 80) {
    throw new RangeError("Watermark size must be between 10 and 80 percent.");
  }
  if (!Number.isFinite(options.rotation) || options.rotation < -90 || options.rotation > 90) {
    throw new RangeError("Watermark rotation must be between -90 and 90 degrees.");
  }
  if (
    !["center", "top-left", "top-right", "bottom-left", "bottom-right", "diagonal"]
      .includes(options.position)
  ) {
    throw new RangeError("Choose a valid watermark position.");
  }
  const color = parseWatermarkColor(options.color);
  if (options.type === "image" && !options.image) {
    throw new RangeError("Choose a PNG or JPEG image for the watermark.");
  }
  if (
    options.image &&
    !["image/png", "image/jpeg"].includes(options.image.type) &&
    !/\.(png|jpe?g)$/i.test(options.image.name)
  ) {
    throw new RangeError("Watermark images must be PNG or JPEG files.");
  }

  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const pageCount = pdf.getPageCount();
  const pages = options.pages ?? Array.from({ length: pageCount }, (_, index) => index + 1);
  if (
    !pages.length ||
    new Set(pages).size !== pages.length ||
    pages.some((page) => !Number.isSafeInteger(page) || page < 1 || page > pageCount)
  ) {
    throw new RangeError(`Choose watermark pages between 1 and ${pageCount}, without duplicates.`);
  }

  const watermarkImage = options.type === "image" && options.image
    ? options.image.type === "image/png" || /\.png$/i.test(options.image.name)
      ? await pdf.embedPng(await options.image.arrayBuffer())
      : await pdf.embedJpg(await options.image.arrayBuffer())
    : null;
  const font = options.type === "text"
    ? await pdf.embedFont(StandardFonts.HelveticaBold)
    : null;
  for (const pageNumber of pages) {
    const page = pdf.getPage(pageNumber - 1);
    const { width, height } = page.getSize();
    const targetWidth = width * options.size / 100;
    const targetHeight = height * options.size / 100;
    if (watermarkImage) {
      const scale = Math.min(
        targetWidth / watermarkImage.width,
        targetHeight / watermarkImage.height,
      );
      const imageWidth = watermarkImage.width * scale;
      const imageHeight = watermarkImage.height * scale;
      const position = getWatermarkPosition(
        options.position,
        width,
        height,
        imageWidth,
        imageHeight,
      );
      page.drawImage(watermarkImage, {
        x: position.x,
        y: position.y,
        width: imageWidth,
        height: imageHeight,
        opacity: options.opacity,
        rotate: degrees(options.rotation + position.angle),
      });
    } else if (font) {
      const size = Math.max(
        8,
        Math.min(96, targetWidth / font.widthOfTextAtSize(watermarkText, 1)),
      );
      const textWidth = font.widthOfTextAtSize(watermarkText, size);
      const textHeight = size * 1.2;
      const position = getWatermarkPosition(
        options.position,
        width,
        height,
        textWidth,
        textHeight,
      );
      page.drawText(watermarkText, {
        x: position.x,
        y: position.y,
        size,
        font,
        color,
        opacity: options.opacity,
        rotate: degrees(options.rotation + position.angle),
      });
    }

    const contents = page.node.Contents();
    if (!(contents instanceof PDFArray) || contents.size() === 0) {
      throw new Error("Unable to mark the watermark for later removal.");
    }
    const stream = pdf.context.lookupMaybe(contents.get(contents.size() - 1), PDFStream);
    if (!stream) throw new Error("Unable to mark the watermark for later removal.");
    stream.dict.set(CYBER_CAFE_WATERMARK_KEY, PDFName.of("true"));
  }
  return pdf.save();
}

export async function removePdfWatermarks(file: File): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  let removed = 0;
  for (const page of pdf.getPages()) {
    const annotations = page.node.Annots();
    if (annotations) {
      for (let index = annotations.size() - 1; index >= 0; index--) {
        const annotation = pdf.context.lookupMaybe(annotations.get(index), PDFDict);
        const subtype = annotation?.lookupMaybe(PDFName.of("Subtype"), PDFName)?.decodeText();
        const name = annotation?.lookupMaybe(PDFName.of("Name"), PDFName)?.decodeText();
        if (subtype === "Watermark" || (subtype === "Stamp" && name === "Watermark")) {
          annotations.remove(index);
          removed++;
        }
      }
      if (annotations.size() === 0) page.node.delete(PDFName.of("Annots"));
    }

    const contents = page.node.Contents();
    if (contents instanceof PDFArray) {
      for (let index = contents.size() - 1; index >= 0; index--) {
        const stream = pdf.context.lookupMaybe(contents.get(index), PDFStream);
        if (stream?.dict.has(CYBER_CAFE_WATERMARK_KEY)) {
          contents.remove(index);
          removed++;
        }
      }
      if (contents.size() === 0) page.node.delete(PDFName.Contents);
    }
  }
  if (!removed) {
    throw new Error("No removable watermark annotation or Cyber Cafe Studio watermark was found.");
  }
  return pdf.save();
}

export async function removeFlattenedWatermarkRegion(
  file: File,
  options: FlattenedWatermarkRemovalOptions,
): Promise<Uint8Array> {
  if (!options.region && !options.text?.trim()) {
    throw new RangeError("Enter watermark text or select the watermark area.");
  }
  if (options.text && options.text.length > 100) {
    throw new RangeError("Watermark search text must be 100 characters or fewer.");
  }
  if (options.region) {
    const { x, y, width, height } = options.region;
    if (
      ![x, y, width, height].every(Number.isFinite) ||
      x < 0 || y < 0 || width <= 0 || height <= 0 ||
      x + width > 1 || y + height > 1
    ) {
      throw new RangeError("Select a valid watermark area inside the page.");
    }
  }
  const fillMatch = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(options.fillColor);
  if (!fillMatch) throw new RangeError("Choose a valid fill color.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const rendered = await loadPdf(bytes);
  const pages = options.pages ?? Array.from(
    { length: rendered.numPages },
    (_, index) => index + 1,
  );
  if (
    !pages.length ||
    new Set(pages).size !== pages.length ||
    pages.some((page) => !Number.isSafeInteger(page) || page < 1 || page > rendered.numPages)
  ) {
    await rendered.destroy();
    throw new RangeError(`Choose pages between 1 and ${rendered.numPages}, without duplicates.`);
  }

  const pagesToEdit = new Set(pages);
  const output = await PDFDocument.create();
  let totalPixels = 0;
  let matchedTextItems = 0;
  try {
    for (let index = 0; index < rendered.numPages; index++) {
      const pageNumber = index + 1;
      const sourcePage = await rendered.getPage(pageNumber);
      const viewport = sourcePage.getViewport({ scale: 2 });
      if (viewport.width * viewport.height > 32_000_000) {
        throw new RangeError("A page is too large to safely rasterize for watermark removal.");
      }
      totalPixels += viewport.width * viewport.height;
      if (totalPixels > 250_000_000) {
        throw new RangeError("This PDF is too large to safely rasterize in one pass.");
      }
      const canvas = document.createElement("canvas");
      try {
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context is unavailable.");
        await sourcePage.render({ canvasContext: context, viewport }).promise;
        if (pagesToEdit.has(pageNumber) && options.region) {
          const { x, y, width, height } = options.region;
          context.fillStyle = `#${fillMatch[1]}${fillMatch[2]}${fillMatch[3]}`;
          context.fillRect(
            x * canvas.width,
            y * canvas.height,
            width * canvas.width,
            height * canvas.height,
          );
        }
        if (pagesToEdit.has(pageNumber) && options.text?.trim()) {
          const searchText = options.text.trim().toLocaleLowerCase();
          const textContent = await sourcePage.getTextContent();
          context.fillStyle = `#${fillMatch[1]}${fillMatch[2]}${fillMatch[3]}`;
          for (const item of textContent.items) {
            if (!("str" in item) || !("transform" in item)) continue;
            if (!item.str.toLocaleLowerCase().includes(searchText)) continue;
            const [, , , , textX, textY] = item.transform;
            const bounds = viewport.convertToViewportRectangle([
              textX,
              textY,
              textX + item.width,
              textY + item.height,
            ]);
            const left = Math.max(0, Math.min(bounds[0], bounds[2]) - 2);
            const top = Math.max(0, Math.min(bounds[1], bounds[3]) - 2);
            const right = Math.min(canvas.width, Math.max(bounds[0], bounds[2]) + 2);
            const bottom = Math.min(canvas.height, Math.max(bounds[1], bounds[3]) + 2);
            context.fillRect(left, top, right - left, bottom - top);
            matchedTextItems++;
          }
        }
        const image = await output.embedPng(canvas.toDataURL("image/png"));
        const outputPage = output.addPage([viewport.width / 2, viewport.height / 2]);
        outputPage.drawImage(image, {
          x: 0,
          y: 0,
          width: viewport.width / 2,
          height: viewport.height / 2,
        });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        sourcePage.cleanup();
      }
    }
    if (options.text?.trim() && matchedTextItems === 0) {
      throw new Error(`No selectable PDF text matched "${options.text.trim()}".`);
    }
    return output.save();
  } finally {
    await rendered.destroy();
  }
}

export async function protectPdfFile(file: File, password: string): Promise<Uint8Array> {
  if (password.length < 8) throw new RangeError("Use a password with at least 8 characters.");
  return encryptPDF(new Uint8Array(await file.arrayBuffer()), password, {
    ownerPassword: crypto.randomUUID(),
    algorithm: "AES-256",
  });
}

export async function unlockPdfFile(file: File, password: string): Promise<UnlockedPdf> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return { bytes: await decryptPDF(bytes, password), flattened: false };
  } catch (error) {
    const encryption = await isEncrypted(bytes);
    if (
      encryption.version !== 4 ||
      !(error instanceof Error) ||
      !/unsupported encryption/i.test(error.message)
    ) {
      throw error;
    }

    const rendered = await loadPdf(bytes, password);
    const output = await PDFDocument.create();
    try {
      for (let index = 0; index < rendered.numPages; index++) {
        const page = await rendered.getPage(index + 1);
        const size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        try {
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas 2D context is unavailable.");
          await page.render({ canvasContext: context, viewport }).promise;
          const image = await output.embedJpg(
            await (await canvasToJpeg(canvas, 0.92)).arrayBuffer(),
          );
          const outputPage = output.addPage([size.width, size.height]);
          outputPage.drawImage(image, {
            x: 0,
            y: 0,
            width: size.width,
            height: size.height,
          });
        } finally {
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
        }
      }
      return { bytes: await output.save(), flattened: true };
    } finally {
      await rendered.destroy();
    }
  }
}

async function loadPdf(bytes: Uint8Array, password?: string) {
  return getDocument({ data: new Uint8Array(bytes), password }).promise;
}

export async function renderPdfPageThumbnails(
  file: File,
  scale = 0.28,
): Promise<string[]> {
  const pdfDocument = await loadPdf(new Uint8Array(await file.arrayBuffer()));
  const thumbnails: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      try {
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context is unavailable.");
        await page.render({ canvasContext: context, viewport }).promise;
        thumbnails.push(canvas.toDataURL("image/jpeg", 0.72));
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    }
    return thumbnails;
  } finally {
    await pdfDocument.destroy();
  }
}

export async function renderPdfPagePreview(
  file: File,
  pageNumber: number,
  scale = 1.5,
): Promise<string> {
  const pdfDocument = await loadPdf(new Uint8Array(await file.arrayBuffer()));
  try {
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      throw new RangeError(`Page number must be between 1 and ${pdfDocument.numPages}.`);
    }
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    try {
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D context is unavailable.");
      await page.render({ canvasContext: context, viewport }).promise;
      return canvas.toDataURL("image/png");
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await pdfDocument.destroy();
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob
        ? resolve(blob)
        : reject(new Error("Could not encode the PDF page as an image.")),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressPdfFile(file: File, qualityPercent: number): Promise<Uint8Array> {
  if (!Number.isFinite(qualityPercent) || qualityPercent < 20 || qualityPercent > 95) {
    throw new RangeError("Compression quality must be between 20 and 95 percent.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const [source, rendered] = await Promise.all([
    PDFDocument.load(bytes),
    loadPdf(bytes),
  ]);
  const output = await PDFDocument.create();
  const sourcePages = source.getPages();
  try {
    for (let index = 0; index < rendered.numPages; index++) {
      const page = await rendered.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      try {
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context is unavailable.");
        await page.render({ canvasContext: context, viewport }).promise;
        const image = await output.embedJpg(
          await (await canvasToJpeg(canvas, qualityPercent / 100)).arrayBuffer(),
        );
        const size = sourcePages[index].getSize();
        const rotated = page.rotate % 180 !== 0;
        const pageWidth = rotated ? size.height : size.width;
        const pageHeight = rotated ? size.width : size.height;
        const outputPage = output.addPage([pageWidth, pageHeight]);
        outputPage.drawImage(image, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    }
    return await output.save();
  } finally {
    await rendered.destroy();
  }
}

export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  if (!files.length) throw new RangeError("Select at least one image.");
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const image = file.type === "image/png"
      ? await pdf.embedPng(await file.arrayBuffer())
      : file.type === "image/jpeg" || file.type === "image/jpg"
        ? await pdf.embedJpg(await file.arrayBuffer())
        : await pdf.embedPng(await imageFileToPng(file));
    const page = pdf.addPage([image.width * 0.75, image.height * 0.75]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: page.getWidth(),
      height: page.getHeight(),
    });
  }
  return pdf.save();
}

async function imageFileToPng(file: File): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result
        ? resolve(result)
        : reject(new Error(`Could not convert ${file.name} to PDF.`)), "image/png");
    });
    return blob.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function pdfToImages(file: File): Promise<PdfOutput[]> {
  const pdfDocument = await loadPdf(new Uint8Array(await file.arrayBuffer()));
  const baseName = getBaseName(file.name);
  const outputs: PdfOutput[] = [];
  try {
    for (let index = 0; index < pdfDocument.numPages; index++) {
      const page = await pdfDocument.getPage(index + 1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas 2D context is unavailable.");
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result
          ? resolve(result)
          : reject(new Error(`Could not export page ${index + 1} as an image.`)), "image/png");
      });
      outputs.push({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        filename: `${baseName}-page-${index + 1}.png`,
      });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await pdfDocument.destroy();
  }
  return outputs;
}

export function downloadPdfOutput(bytes: Uint8Array, filename: string): void {
  const type = filename.toLowerCase().endsWith(".png") ? "image/png" : "application/pdf";
  const blob = type === "application/pdf"
    ? pdfBlob(bytes)
    : new Blob([new Uint8Array(bytes)], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
