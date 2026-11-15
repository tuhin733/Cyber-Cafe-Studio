export const MAX_IMAGE_OUTPUT_PIXELS = 32_000_000;

export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

export interface ImagePreset {
  id: string;
  label: string;
  group: "universal" | "identity" | "government";
  width: number;
  height: number;
  dpi: number;
}

export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
  zoom = 1,
  centerX = 0.5,
  centerY = 0.5,
): ImageCrop {
  const aspectRatio = outputWidth / outputHeight;
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const baseWidth = sourceAspectRatio > aspectRatio ? sourceHeight * aspectRatio : sourceWidth;
  const baseHeight = sourceAspectRatio > aspectRatio ? sourceHeight : sourceWidth / aspectRatio;
  const cropWidth = baseWidth / Math.max(1, zoom);
  const cropHeight = baseHeight / Math.max(1, zoom);
  const halfWidth = cropWidth / 2;
  const halfHeight = cropHeight / 2;
  const x = Math.min(sourceWidth - halfWidth, Math.max(halfWidth, centerX * sourceWidth)) - halfWidth;
  const y = Math.min(sourceHeight - halfHeight, Math.max(halfHeight, centerY * sourceHeight)) - halfHeight;

  return { x, y, width: cropWidth, height: cropHeight };
}

export const IMAGE_PRESETS: ImagePreset[] = [
  { id: "standard-photo", label: "Standard passport photo", group: "universal", width: 413, height: 531, dpi: 300 },
  { id: "standard-signature", label: "Standard signature", group: "universal", width: 413, height: 177, dpi: 300 },
  { id: "pan-photo", label: "PAN card · Photo", group: "identity", width: 213, height: 213, dpi: 200 },
  { id: "pan-signature", label: "PAN card · Signature", group: "identity", width: 1023, height: 680, dpi: 200 },
  { id: "passport-seva-photo", label: "Passport Seva · Photo", group: "identity", width: 413, height: 531, dpi: 300 },
  { id: "passport-seva-signature", label: "Passport Seva · Signature", group: "identity", width: 531, height: 236, dpi: 300 },
  { id: "ssc-photo", label: "SSC · Photo", group: "government", width: 413, height: 531, dpi: 300 },
  { id: "ssc-signature", label: "SSC · Signature", group: "government", width: 472, height: 236, dpi: 300 },
  { id: "upsc-photo", label: "UPSC · Photo (square)", group: "government", width: 500, height: 500, dpi: 300 },
  { id: "upsc-signature", label: "UPSC · Signature (square)", group: "government", width: 500, height: 500, dpi: 300 },
  { id: "ibps-photo", label: "IBPS / SBI · Photo", group: "government", width: 200, height: 230, dpi: 300 },
  { id: "ibps-signature", label: "IBPS / SBI · Signature", group: "government", width: 140, height: 60, dpi: 300 },
  { id: "ibps-thumb", label: "IBPS / SBI · Left thumb impression", group: "government", width: 240, height: 240, dpi: 300 },
  { id: "ibps-declaration", label: "IBPS / SBI · Handwritten declaration", group: "government", width: 800, height: 400, dpi: 300 },
  { id: "rrb-photo", label: "Railways (RRB) · Photo", group: "government", width: 320, height: 240, dpi: 300 },
  { id: "rrb-signature", label: "Railways (RRB) · Signature", group: "government", width: 140, height: 60, dpi: 300 },
  { id: "nta-passport-photo", label: "NTA · Passport photo", group: "government", width: 413, height: 531, dpi: 300 },
  { id: "nta-postcard-photo", label: "NTA / NEET · Postcard photo", group: "government", width: 1200, height: 1800, dpi: 300 },
  { id: "nta-signature", label: "NTA · Signature", group: "government", width: 413, height: 177, dpi: 300 },
];

export function millimetresToPixels(mm: number, dpi: number): number {
  if (!Number.isFinite(mm) || mm <= 0 || !Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError("Enter valid positive dimensions and DPI.");
  }
  return Math.max(1, Math.round((mm * dpi) / 25.4));
}

export function validateOutputDimensions(width: number, height: number): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError("Width and height must be positive whole pixels.");
  }
  if (width * height > MAX_IMAGE_OUTPUT_PIXELS) {
    throw new RangeError(
      `The output exceeds the ${MAX_IMAGE_OUTPUT_PIXELS.toLocaleString()} pixel safety limit. Reduce its dimensions.`,
    );
  }
}

export function getImageExtension(format: ImageFormat): string {
  switch (format) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
