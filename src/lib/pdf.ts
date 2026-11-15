import type { LayoutSettings, UploadedDoc } from "../types";
import { paginate, type PlacedDoc } from "./pagination";

export const PDF_COMPRESSION_OPTIONS = [
  {
    id: "original",
    label: "Original",
    description: "Original image quality.",
    jpegQuality: 1,
    maxDpi: Infinity,
    imageFormat: "PNG",
  },
  {
    id: "extreme",
    label: "Extreme compression",
    description: "Less quality, high compression.",
    jpegQuality: 0.42,
    maxDpi: 96,
    imageFormat: "JPEG",
  },
  {
    id: "recommended",
    label: "Recommended compression",
    description: "Good quality, good compression.",
    jpegQuality: 0.82,
    maxDpi: 240,
    imageFormat: "JPEG",
  },
  {
    id: "less",
    label: "Less compression",
    description: "High quality, less compression.",
    jpegQuality: 0.92,
    maxDpi: Infinity,
    imageFormat: "JPEG",
  },
] as const;

export type PdfCompression = (typeof PDF_COMPRESSION_OPTIONS)[number]["id"];

interface CompressionSettings {
  jpegQuality: number;
  maxDpi: number;
  imageFormat: "JPEG" | "PNG";
}

/**
 * Convert a File into an HTMLImageElement and return a canvas
 * with the raw pixel data. We use this to embed high-res images
 * into the PDF without quality loss.
 */
function fileToCanvas(file: File): Promise<{
  canvas: HTMLCanvasElement;
  pxW: number;
  pxH: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve({ canvas, pxW: img.naturalWidth, pxH: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/** Generate a multi-page A4 PDF from the uploaded documents. */
export async function generatePDF(
  docs: UploadedDoc[],
  settings: LayoutSettings,
  compression: PdfCompression = "recommended",
  blankPageCount = 0,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { pages } = paginate(docs, settings, blankPageCount);
  const sourceCanvases = new Map<string, HTMLCanvasElement>();
  for (const doc of docs) {
    if (sourceCanvases.has(doc.id)) continue;
    const { canvas } = await fileToCanvas(doc.file);
    sourceCanvases.set(doc.id, canvas);
  }

  const buildPdf = (option: CompressionSettings): Blob => {
    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });
    const renderScale = new Map<string, number>();
    for (const page of pages) {
      for (const placed of page) {
        const { doc, w, h } = placed;
        const scale = Number.isFinite(option.maxDpi)
          ? Math.min(
              1,
              (w * option.maxDpi) / 25.4 / doc.pxW,
              (h * option.maxDpi) / 25.4 / doc.pxH,
            )
          : 1;
        const currentScale = renderScale.get(doc.id) ?? 1;
        renderScale.set(doc.id, Math.min(currentScale, scale));
      }
    }

    const cache = new Map<string, string>();
    for (const doc of docs) {
      if (cache.has(doc.id)) continue;
      const canvas = sourceCanvases.get(doc.id);
      if (!canvas) throw new Error(`Missing image data for ${doc.fileName}`);
      const scale = renderScale.get(doc.id) ?? 1;
      let imageCanvas = canvas;
      if (scale < 1) {
        imageCanvas = document.createElement("canvas");
        imageCanvas.width = Math.max(1, Math.round(canvas.width * scale));
        imageCanvas.height = Math.max(1, Math.round(canvas.height * scale));
        const context = imageCanvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable");
        context.drawImage(canvas, 0, 0, imageCanvas.width, imageCanvas.height);
      }
      cache.set(
        doc.id,
        option.imageFormat === "PNG"
          ? imageCanvas.toDataURL("image/png")
          : imageCanvas.toDataURL("image/jpeg", option.jpegQuality),
      );
    }

    pages.forEach((page, pageIdx) => {
      if (pageIdx > 0) pdf.addPage();

      for (const placed of page) {
        const dataUrl = cache.get(placed.doc.id);
        if (dataUrl) {
          pdf.addImage(dataUrl, option.imageFormat, placed.x, placed.y, placed.w, placed.h);
        }
      }
    });

    return pdf.output("blob");
  };

  const option = PDF_COMPRESSION_OPTIONS.find((item) => item.id === compression);
  if (!option) throw new Error(`Unknown PDF compression option: ${compression}`);
  return buildPdf(option);
}

/** Trigger a browser download for a blob */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save the generated PDF and report whether the save was completed. */
export async function savePDF(blob: Blob, filename: string): Promise<boolean> {
  if (window.desktopAPI) {
    const result = await window.desktopAPI.savePdf(
      new Uint8Array(await blob.arrayBuffer()),
      filename,
    );
    return !result.canceled;
  }
  downloadBlob(blob, filename);
  return true;
}

export type { PlacedDoc };
